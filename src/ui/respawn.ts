/**
 * Where to wake after a death, picked over the world (`src/game/respawn.ts`).
 *
 * The island offers it on every beat while the body may pick (`fallen`); this
 * shows the first join's cards (`stoneCards`): the five Runestones and each
 * settlement the body may wake at, each with its distance from where it fell,
 * and a way to stay on the spawn. The pick goes to the island
 * (`Island.respawn`), which puts the body there; a pick refused is shown again
 * with why. An offer the island stops making (another tab picked, or the body
 * stepped off) takes the chooser away.
 *
 * Inside the interface root, as a question is (`ask.ts`), so a phone's scale
 * applies to it. Keys stay in it: Tab goes round it, the arrows go between the
 * cards, Enter or Space picks; nothing reaches the game behind it.
 *
 * Built a node at a time, with no markup (src/page-guard.ts).
 */
import {
  DEEDS_HEAD, RESPAWN_STAY, RESPAWN_TITLE, respawnChoices, STAY_SAID, STONES_HEAD, tilesBetween, tilesSaid, type Fallen,
} from '../game/respawn';
import type { Game } from '../game/game';
import type { Island } from '../net/island';
import { deedTotemVariant } from '../render/deedtotem';
import { stoneCards, type StoneCard } from './stonestart';

/** A chooser on the screen: the pick it answers with, and a way to take it off unanswered. */
export interface RespawnShown {
  el: HTMLElement;
  done: Promise<string>;
  close(): void;
}

/**
 * Put the chooser on `root` for a body that fell as `fell` says, on a world
 * `size` across whose spawn is `spawn` (the middle of its tile). `why` is a
 * refusal of the last pick, said over the cards.
 */
export function showRespawn(root: HTMLElement, fell: Fallen, size: number, spawn: { x: number; y: number }, why: string | null = null): RespawnShown {
  let settle: (at: string) => void = () => {};
  const done = new Promise<string>((r) => { settle = r; });
  const el = document.createElement('div');
  el.className = 'respawn';
  const card = document.createElement('div');
  card.className = 'respawn-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  const title = document.createElement('div');
  title.className = 'respawn-title';
  title.id = 'respawn-title';
  title.textContent = RESPAWN_TITLE;
  card.setAttribute('aria-labelledby', title.id);
  card.append(title);
  if (why) {
    const no = document.createElement('div');
    no.className = 'respawn-why';
    no.setAttribute('role', 'alert');
    no.textContent = why;
    card.append(no);
  }

  const pick = (at: string): void => {
    el.remove();
    settle(at);
  };
  const choices = respawnChoices(fell, size);
  const asCard = (c: (typeof choices)[number]): StoneCard => ({
    key: c.at,
    pic: c.stone ? { stone: c.stone } : { totem: { level: c.deed!.level, variant: deedTotemVariant(c.deed!.x, c.deed!.y) } },
    name: c.name,
    place: c.place,
    far: tilesSaid(c.tiles),
  });
  const box = stoneCards([
    { head: STONES_HEAD, cards: choices.filter((c) => c.stone).map(asCard) },
    { head: DEEDS_HEAD, cards: choices.filter((c) => c.deed).map(asCard) },
  ], pick);
  card.append(box);

  const stay = document.createElement('button');
  stay.type = 'button';
  stay.className = 'respawn-stay';
  stay.dataset.at = RESPAWN_STAY;
  stay.textContent = `${STAY_SAID}: ${tilesSaid(tilesBetween(fell, spawn))}`;
  stay.addEventListener('click', () => pick(RESPAWN_STAY));
  card.append(stay);
  el.append(card);

  const stops = (): HTMLElement[] => [...card.querySelectorAll<HTMLElement>('button')];
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const all = stops();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number): void => {
      e.preventDefault();
      all[(i + all.length) % all.length]?.focus();
    };
    if (e.key === 'Tab') go(at + (e.shiftKey ? -1 : 1));
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(all.length - 1);
  });
  // Nothing typed here walks the body or opens a window behind it.
  el.addEventListener('keyup', (e) => e.stopPropagation());
  el.addEventListener('keypress', (e) => e.stopPropagation());
  // A press on the dark round the card picks nothing, and keeps the keys on the card.
  el.addEventListener('pointerdown', (e) => {
    if (e.target !== el) return;
    e.preventDefault();
    if (!card.contains(document.activeElement)) stops()[0]?.focus();
  });

  root.append(el);
  stops()[0]?.focus();
  return { el, done, close: () => el.remove() };
}

/**
 * Show the chooser whenever the island offers it, and send the pick. One at a
 * time; while a pick is on its way, the beats' offers wait for its answer.
 */
export function mountRespawn(root: HTMLElement, game: Game, island: Island): void {
  let open: RespawnShown | null = null;
  let asking = false;
  let shownFor = '';
  const show = (fell: Fallen, why: string | null): void => {
    open?.close();
    shownFor = `${fell.x},${fell.y}`;
    const me = showRespawn(root, fell, island.info?.size ?? game.world.w, { x: game.spawn.x + 0.5, y: game.spawn.y + 0.5 }, why);
    open = me;
    void me.done.then(async (at) => {
      if (open === me) open = null;
      asking = true;
      const no = await island.respawn(at).catch((e: unknown) => (e instanceof Error ? e.message : 'The island did not answer.'));
      asking = false;
      if (no && at !== RESPAWN_STAY) show(fell, no);
      else if (no) game.logMsg(no, 'error');
    });
  };
  island.hooks.fallen = (fell) => {
    if (asking) return;
    if (!fell) {
      open?.close();
      open = null;
      return;
    }
    if (open && shownFor === `${fell.x},${fell.y}`) return;
    game.player.stop();
    show(fell, null);
  };
}
