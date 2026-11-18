/**
 * The Runestone a first join starts beside, picked on the boot card; and the
 * cards it is picked from, which the death chooser shows too.
 *
 * Asked for: "new players should select between the 5 runestones for
 * spawning, and spawn 2 tiles away from that stone on selection". Somebody
 * with no body on the island yet is shown the five (`startChoices`), each
 * named with where on the inner bay it stands; the one clicked goes to the
 * island with the join (`Island.join`, `rpc_join`'s `p_stone`), which puts
 * the new body `START_GAP` tiles out from that stone's edge and says where.
 * Somebody coming back, or a test's world with no stones, is never shown it.
 *
 * And asked for: "show pictures of the runestones on the picker". Each
 * button carries its stone as the island draws it (`drawRunestone`, the
 * renderer's own painter, which needs no world): on a patch of grass in the
 * noon light, from the camera's first turn, its runes breathing and its
 * motes rising as they do in the game -- held still under less motion.
 *
 * The cards themselves (`stoneCards`) are the death chooser's as well
 * (`src/ui/respawn.ts`): the same five, each with its distance from where the
 * body fell, and a card for each settlement it may wake at, its token drawn
 * as the renderer draws it (`drawDeedTotem`).
 *
 * Built a node at a time, with no markup: the page takes no HTML from a
 * string (src/page-guard.ts).
 */
import { START_GAP, type Runestone, type RunestoneId } from '../game/runestones';
import { deedTotemBounds, drawDeedTotem, type DeedTotemLook } from '../render/deedtotem';
import { drawRunestone, runestoneBounds } from '../render/runestone';
import { sunOfDay } from '../render/sun';
import { TILE_DEFS, TileType } from '../world/tiles';

/** What the chooser is headed. */
export const STONE_PICK_HEAD = `Starting Runestone: ${START_GAP} tiles from it`;

/** The camera's turn the pictures are seen from: the one a new body first looks through. */
const PIC_TURN = 0;

/** What a card's picture shows: a Runestone, or a settlement's token. */
export type CardPic = { stone: RunestoneId } | { totem: DeedTotemLook };

/** One card: what picking it answers, its picture, its name, where it is, and how far (shown when given). */
export interface StoneCard {
  key: string;
  pic: CardPic;
  name: string;
  place: string;
  far?: string;
}

/** Cards under a head of their own. */
export interface CardGroup {
  head: string;
  cards: readonly StoneCard[];
}

/**
 * The grass under a picture: the island's grass, flat and lit by the noon
 * sun, as the renderer shades a level tile (`computeColor`).
 */
function grassColour(): string {
  const [r, g, b] = TILE_DEFS[TileType.Grass].color;
  const shade = 0.48 + 0.6 * Math.max(0, sunOfDay(0.5)[2]);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * shade)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** What a picture covers from its foot, in pixels at zoom one: left, top, right, bottom. */
const boundsOf = (pic: CardPic): [number, number, number, number] =>
  'stone' in pic ? runestoneBounds(pic.stone, PIC_TURN) : deedTotemBounds(pic.totem, PIC_TURN);

/**
 * Paint `canvas` with its grass and, unless `pic` is null, the stone or token
 * at `zoom`, stood on the middle of its footprint `foot` pixels above the
 * bottom. `t` is the runes' clock, in seconds.
 */
function paintPic(canvas: HTMLCanvasElement, grass: string, pic: CardPic | null, zoom: number, foot: number, t: number): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = grass;
  g.fillRect(0, 0, canvas.width, canvas.height);
  if (!pic) return;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  if ('stone' in pic) drawRunestone(g, canvas.width / 2, canvas.height - foot, zoom, pic.stone, PIC_TURN, 0, t);
  else drawDeedTotem(g, canvas.width / 2, canvas.height - foot, zoom, pic.totem, PIC_TURN, 0, t);
}

/** Whether the page asks for less motion: Settings, Motion, or the system's own. */
const stillWanted = (): boolean =>
  document.documentElement.dataset.motion === 'less' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The cards, a button each, under their heads: `picked` is called with the
 * key of the one clicked. The pictures paint themselves once the box is on
 * the page, and stop when it goes.
 */
export function stoneCards(groups: readonly CardGroup[], picked: (key: string) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'boot-stones';
  const pics: Array<{ canvas: HTMLCanvasElement; pic: CardPic }> = [];
  for (const group of groups) {
    if (!group.cards.length) continue;
    const head = document.createElement('div');
    head.className = 'boot-stones-head';
    head.textContent = group.head;
    box.append(head);
    for (const c of group.cards) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boot-stone';
      b.dataset.at = c.key;
      if ('stone' in c.pic) b.dataset.stone = c.pic.stone;
      const pic = document.createElement('canvas');
      pic.className = 'boot-stone-pic';
      pic.setAttribute('aria-hidden', 'true');
      pics.push({ canvas: pic, pic: c.pic });
      const words = document.createElement('span');
      words.className = 'boot-stone-words';
      const name = document.createElement('b');
      name.textContent = c.name;
      const place = document.createElement('span');
      place.textContent = c.place;
      words.append(name, place);
      if (c.far !== undefined) {
        const far = document.createElement('em');
        far.className = 'boot-stone-far';
        far.textContent = c.far;
        words.append(far);
      }
      b.append(pic, words);
      b.addEventListener('click', () => picked(c.key));
      box.append(b);
    }
  }
  drawPictures(box, pics);
  return box;
}

/**
 * Show the stones on `card` and wait for one to be clicked: its id. With no
 * stones to pick between, nothing is shown and the answer is null at once.
 */
export function pickStone(card: Element | null, stones: readonly Runestone[]): Promise<RunestoneId | null> {
  if (!card || !stones.length) return Promise.resolve(null);
  return new Promise((done) => {
    const box = stoneCards([{ head: STONE_PICK_HEAD, cards: stones.map((s) => ({ key: s.id, pic: { stone: s.id }, name: s.name, place: s.place })) }], (key) => {
      box.remove();
      card.classList.remove('boot-picking');
      done(stones.find((s) => s.id === key)?.id ?? null);
    });
    card.classList.add('boot-picking');
    card.append(box);
    (box.querySelector('button') as HTMLButtonElement | null)?.focus();
  });
}

/**
 * Size the pictures to the pixels they are shown at and paint them, then
 * keep their runes breathing until the chooser goes. The first time a stone
 * or token is drawn it is baked (`drawRunestone`, `drawDeedTotem`), most of a
 * tenth of a second each: one comes in a frame, so the card answers while
 * they do. After that a frame is one blit and the runes' light per picture.
 */
function drawPictures(box: HTMLElement, pics: ReadonlyArray<{ canvas: HTMLCanvasElement; pic: CardPic }>): void {
  if (!pics.length) return;
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const grass = grassColour();
  let w = 0, h = 0;
  /** The zoom and the foot of each kind of picture: the stones', and the tokens'. */
  const scale = new Map<string, { zoom: number; foot: number }>();
  const kindOf = (pic: CardPic): string => ('stone' in pic ? 'stone' : 'totem');
  const fit = (): boolean => {
    const c = pics[0].canvas;
    const cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
    if (!cw || !ch) return false;
    if (cw === w && ch === h) return true;
    w = cw;
    h = ch;
    /*
     * One zoom for all of a kind, so the stones stand at their true sizes
     * against one another, and the tokens against one another: the tallest
     * fitted top to bottom, less the margin its bounds keep for the glow
     * (`runestoneBounds`), and the widest outcrop let run a little off the
     * sides, where the grass goes on. A token is a post beside a stone, and
     * at the stones' zoom would be a speck.
     */
    scale.clear();
    for (const kind of new Set(pics.map((p) => kindOf(p.pic)))) {
      // A token's bounds keep no margin for a glow by day.
      const PAD = kind === 'stone' ? 14 : 0;
      let tall = 0, wide = 0, below = 0;
      for (const p of pics) {
        if (kindOf(p.pic) !== kind) continue;
        const [l, tp, rt, bt] = boundsOf(p.pic);
        tall = Math.max(tall, bt - tp - 2 * PAD);
        wide = Math.max(wide, 2 * Math.max(-l, rt) - 2 * PAD);
        below = Math.max(below, bt - PAD);
      }
      const zoom = Math.min((h * 0.94) / tall, (w * 1.2) / wide);
      scale.set(kind, { zoom, foot: below * zoom + h * 0.02 });
    }
    for (const p of pics) {
      p.canvas.width = w;
      p.canvas.height = h;
    }
    return true;
  };
  // How many of the pictures are in: the rest are their grass until their turn.
  let shown = 0;
  const paint = (t: number): void => {
    if (!fit()) return;
    pics.forEach((p, i) => {
      const s = scale.get(kindOf(p.pic))!;
      paintPic(p.canvas, grass, i < shown ? p.pic : null, s.zoom, s.foot, t);
    });
  };
  // Held still (less motion): the runes a little way into a breath, painted again only when the pictures change size.
  const still = stillWanted();
  const STILL_T = 1.2;
  let last = -1;
  // Whether the box has been on the page: built before it is put there, it waits for it; gone from it, it stops.
  let on = false;
  const frame = (ms: number): void => {
    if (!box.isConnected) {
      if (!on) requestAnimationFrame(frame);
      return;
    }
    on = true;
    // Not laid out yet: nothing to size the pictures by.
    if (!fit()) {
      requestAnimationFrame(frame);
      return;
    }
    const coming = shown < pics.length;
    // Thirty frames a second is all a breath and a rising mote want.
    if (coming || (!still && ms - last >= 33)) {
      last = ms;
      if (coming) shown++;
      paint(still ? STILL_T : ms / 1000);
    }
    if (!still || shown < pics.length) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (still) {
    const seen = new ResizeObserver(() => {
      if (!box.isConnected && on) seen.disconnect();
      else if (shown === pics.length) paint(STILL_T);
    });
    seen.observe(pics[0].canvas);
  }
}
