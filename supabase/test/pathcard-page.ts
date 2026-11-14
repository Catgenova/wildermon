/**
 * The page `pathcard.ts` opens: the Path's card (`src/ui/pathcard.ts`) on a game screen of its own, with the sculpted
 * bodies loaded. Each step's `met` is put to a set the driver fills (what makes a step met on the island is
 * `path.ts`'s business), and the island's doors answer at once. Driven through `window.pathcard`.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { EMOTE_BY_ID } from '../../src/game/emotes';
import { pathCheck, PATH_DETOURS, PATH_STEPS } from '../../src/game/path';
import { setAnimations } from '../../src/engine/motion';
import { figureStats, flatFigures, sculptedFigures, sculptedReady, sculptSoft } from '../../src/render/figure';
import { loadWildermon } from '../../src/render/wildermon';
import { PathCard } from '../../src/ui/pathcard';
import { previewKnobs } from '../../src/ui/pathpreview';

// Bodies drawn by the processor (this harness's GL) move here: it is here to see them move.
previewKnobs.stillOnSoft = false;
setAnimations(true);
sculptedFigures(true);

const root = document.createElement('div');
root.id = 'ui';
document.body.append(root);

const game = Game.create(4243, 128);
game.ask = () => {};
// Dressed, as somebody a while ashore is.
for (const [slot, id] of [['chest', 'cloth_tunic'], ['legs', 'cloth_trousers'], ['feet', 'cloth_shoes']] as const) {
  const it = game.inventory.add(id, { ql: 30 });
  if (it) game.equip(slot, it.uid);
}
const met = new Set<string>();
for (const s of [...PATH_STEPS, ...PATH_DETOURS]) (s as { met: (g: Game) => boolean }).met = () => met.has(s.id);
game.thePath = { on: false, skip: [], supply: {}, did: {} };
game.pathDoor = {
  turn: async (on) => {
    game.thePath = { ...(game.thePath ?? { skip: [], supply: {}, did: {} }), on };
    game.events.emit('path');
    game.events.emit('pathTurned', on);
    return null;
  },
  skip: async (step, skip) => {
    const p = game.thePath!;
    game.thePath = { ...p, skip: skip ? [...p.skip, step] : p.skip.filter((x) => x !== step) };
    game.events.emit('path');
    return null;
  },
};
let opened = 0;
/** The page's clock as the card's look is handed it, moved on past its interval each time. */
let clock = 0;
const card = new PathCard(root, game, () => opened++);

export interface CardView {
  open: boolean;
  shown: number;
  done: string;
  next: string;
  how: string[];
  why: string[];
  buttons: string[];
  tabOpened: number;
}

function view(): CardView {
  const rows = (sel: string): string[] => [...card.el.querySelectorAll(`${sel} > div`)].map((d) => d.textContent ?? '');
  return {
    open: card.isOpen,
    shown: card.shown,
    done: card.el.querySelector('.path-card-done')?.textContent ?? '',
    next: card.el.querySelector('.path-card-next')?.textContent ?? '',
    how: rows('.path-card-lines:not(.path-card-why)'),
    why: rows('.path-card-why'),
    buttons: [...card.el.querySelectorAll('button')].map((b) => b.textContent ?? ''),
    tabOpened: opened,
  };
}

/** The share of the picture that is not blank, and a hash of it. */
function picture(): { share: number; sum: number } {
  const c = card.preview.el;
  const g = c.getContext('2d');
  if (!g || !c.width) return { share: 0, sum: 0 };
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let on = 0, sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 8) on++;
    sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) % 1000000007;
  }
  return { share: on / (d.length / 4), sum };
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const api = {
  /** Sculpted bodies and the Path's kinds loaded. */
  ready: (async () => {
    for (let i = 0; i < 300 && !sculptedReady(); i++) await wait(50);
    await Promise.all(['bevere', 'quarra', 'mola', 'embra', 'magga'].map((k) => loadWildermon(k)));
  })(),
  /** Steps met from now on (on the island, say). */
  meet(ids: string[]): void {
    for (const id of ids) met.add(id);
  },
  /** A look over the steps, as the journal's clock makes; the game's clock moved on a little. */
  look(): CardView {
    game.time += 1;
    pathCheck(game);
    return view();
  },
  /** The Path on or off, as its switch does it. */
  async turn(on: boolean): Promise<void> {
    await game.pathDoor?.turn(on);
  },
  /** Page opened with the Path on: the state as a beat brings it, no switch. */
  pageOn(): void {
    game.thePath = { on: true, skip: [], supply: {}, did: {} };
  },
  view,
  picture,
  frames: (): number => card.preview.frames,
  /** How the bodies are drawn here, and what the picture's last frame cost. */
  stats: (): string => `sculpted ${sculptedReady()} flat ${flatFigures()} soft ${sculptSoft()} cost ${card.preview.cost.toFixed(1)} ms frames ${card.preview.frames}`,
  redraws: (): number => figureStats.redraws,
  animations(on: boolean): void {
    setAnimations(on);
  },
  popups(on: boolean): void {
    game.settings.pathPopups = on;
  },
  click(text: string): CardView {
    [...card.el.querySelectorAll('button')].find((b) => b.textContent === text)?.click();
    return view();
  },
  /** The picture's own drawing stopped, for frames drawn one at a time (`frameAt`). */
  freeze(): void {
    card.preview.stop();
  },
  /** The picture of the step the card names drawn `t` seconds in. */
  frameAt(t: number): void {
    const next = card.says().next;
    if (next) card.preview.drawAt(next.show, t);
  },
  /** How long a go of the step the card names takes, seconds: its job's time, or its emote's. */
  goLength(): number {
    const show = card.says().next?.show;
    return show?.job ? ACTION_BY_ID.get(show.job)?.baseTime ?? 2 : show?.emote ? EMOTE_BY_ID.get(show.emote)?.seconds ?? 2 : 2;
  },
  /** A job started, and the game's clock at `secs` after the card went up. */
  startJob(id: string, secs: number): CardView {
    game.time += secs;
    game.action = { def: { id } as never, target: { kind: 'self' } as never, state: 'performing', elapsed: 0, duration: 1 } as never;
    clock += 1000;
    card.update(clock);
    return view();
  },
  wait,
};
(window as unknown as { pathcard: typeof api }).pathcard = api;
