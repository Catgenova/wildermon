/**
 * The page `deathchooser.ts` opens: the game's body, the island's own `Island` and the death chooser on the interface
 * root (`mountRespawn`), wired as `src/net/play.ts` wires them. Every door the page knocks at goes to the real island
 * the test made (`window.islandRpc`, answered from the database); any other is refused. The words about walking go as
 * the loop says them (`Island.tellWhere`), and the beats as the island's own timer asks them (`Island.pulse`).
 * Driven through `window.dc`.
 */
import { Game } from '../../src/game/game';
import { Island } from '../../src/net/island';
import { supabase } from '../../src/net/supabase';
import { mountRespawn } from '../../src/ui/respawn';
import { DEATH_TITLE } from '../../src/game/deathcard';

/** The doors this page may knock at; the test answers them off the database. */
const DOORS = new Set(['rpc_move', 'rpc_settle', 'rpc_respawn']);
type Answer = { data: unknown; error: { message: string; code?: string } | null };
const bridge = (window as unknown as { islandRpc: (door: string, args: unknown) => Promise<Answer> }).islandRpc;
const asked: string[] = [];
const sb = supabase() as unknown as Record<string, unknown>;
sb.rpc = async (door: string, args: unknown): Promise<Answer> => {
  asked.push(door);
  if (!DOORS.has(door)) return { data: null, error: { message: `${door}: not in this test` } };
  return bridge(door, args ?? {});
};

const game = Game.create(4242, 256);
game.bodyFromIsland = true;
game.packFromIsland = true;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.tallyFromIsland = true;
game.journalReady = false;
game.ask = () => {};
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
uiRoot.style.cssText = 'position:fixed;inset:0';
document.body.appendChild(uiRoot);

/** Every time the island put the body somewhere (`hooks.moved`): where, and whether the walk was to go on (`resume`). */
const moved: Array<{ x: number; y: number; level: number; resume: boolean }> = [];
let island: Island | null = null;
let t = 1000;

/** On the island `world` (`size` across, spawn tile `spawn`), the body at `at`, as `play.ts` wires it. */
function setup(world: string, size: number, spawn: { x: number; y: number }, at: { x: number; y: number }): void {
  game.spawn = { ...spawn };
  game.putBody(at.x, at.y, 0);
  island = new Island({
    say: () => {}, ground: () => {}, people: () => {}, pack: () => {},
    moved: (x, y, level, letGo, resume) => {
      moved.push({ x, y, level, resume: resume === true });
      if (letGo) game.letGoOfAll();
      game.putBody(x, y, level, resume);
    },
    fell: (fell) => { game.player.fell = fell; },
  });
  (island as unknown as { info: unknown }).info = { id: world, size, spawn_x: spawn.x, spawn_y: spawn.y };
  mountRespawn(uiRoot, game, island);
}

/** A word about walking, as the loop says it: the body at `x, y` on the ground, and the island's answer. */
async function step(x: number, y: number): Promise<void> {
  game.player.x = x;
  game.player.y = y;
  t += 1;
  await (island as unknown as { tellWhere: (x: number, y: number, l: number, must: boolean) => Promise<unknown> }).tellWhere(x, y, 0, true);
  await settle();
}

/** A beat, as the island's timer asks it. */
async function beat(): Promise<void> {
  await (island as unknown as { pulse: () => Promise<boolean> }).pulse();
  await settle();
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

export interface Seen {
  open: boolean;
  /** The death card: its title, then each row as `label: line | line`. */
  death: string[];
  /** Each card, as `at|name|place|distance`. */
  cards: string[];
  grace: string | null;
  body: { x: number; y: number; level: number };
  moved: Array<{ x: number; y: number; level: number; resume: boolean }>;
  /** The card is on top of everything at its middle: nothing else drawn over it. */
  onTop: boolean;
  /** Doors knocked at, in order. */
  asked: string[];
}

function read(): Seen {
  const el = uiRoot.querySelector<HTMLElement>('.respawn');
  const card = el?.querySelector<HTMLElement>('.respawn-card');
  const r = card?.getBoundingClientRect();
  const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 8) : null;
  return {
    open: !!el,
    death: [
      el?.querySelector('.respawn-death-title')?.textContent ?? '',
      ...[...(el?.querySelectorAll<HTMLElement>('.respawn-death-row') ?? [])].map((row) =>
        `${row.querySelector('.respawn-death-label')?.textContent}: ${[...row.querySelectorAll('.respawn-death-lines > span')].map((s) => s.textContent).join(' | ')}`),
    ].filter((s) => s !== ''),
    cards: [...(el?.querySelectorAll<HTMLButtonElement>('.boot-stone') ?? [])].map((b) =>
      `${b.dataset.at}|${b.querySelector('b')?.textContent}|${b.querySelector('.boot-stone-words > span')?.textContent}|${b.querySelector('.boot-stone-far')?.textContent}`),
    grace: el?.querySelector('.respawn-grace')?.textContent ?? null,
    body: { x: game.player.x, y: game.player.y, level: game.player.level },
    moved: moved.slice(),
    onTop: !!hit && !!card && card.contains(hit),
    asked: asked.slice(),
  };
}

/** Click a card (after the chooser's first moments), and wait for the island's answer and the beat after it. */
async function click(at: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700));
  uiRoot.querySelector<HTMLButtonElement>(`.respawn [data-at="${at}"]`)?.click();
  for (let i = 0; i < 40 && uiRoot.querySelector('.respawn'); i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 300));
}

/** Wait (two seconds at most) for the chooser, as the beat armed after a put brings it. */
async function waitOpen(): Promise<boolean> {
  for (let i = 0; i < 40 && !uiRoot.querySelector('.respawn'); i++) await new Promise((r) => setTimeout(r, 50));
  return !!uiRoot.querySelector('.respawn');
}

export interface Driven {
  setup: typeof setup;
  step: typeof step;
  beat: typeof beat;
  read: typeof read;
  click: typeof click;
  waitOpen: typeof waitOpen;
  title: string;
}
(window as unknown as { dc: Driven }).dc = { setup, step, beat, read, click, waitOpen, title: DEATH_TITLE };
