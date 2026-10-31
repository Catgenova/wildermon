import { NICHE_H, NICHE_W, paintFrame, paintNiche, paintPlate, reachOf, seedOf, sideOf, type ArtOpts } from '../ui/runecut-art';
import { FRAME_RIM, frameFor } from '../ui/runecut-frames';
import { runeFor } from '../ui/theme';

/**
 * A window's dress, on a box of the landing page: the Faith window's (marble,
 * pearl and sea glass, the crescent in its niche), or the Trades window's
 * (iron-bound planks) on the box while it holds the character creator. Its
 * slab, its frame and the rune in the niche at the head of its title, painted
 * by Runecut's own painters (`src/ui/runecut-art.ts`, `src/ui/runecut-frames.ts`)
 * with that window's own seed, so the box and the window in the game are the
 * same piece of stone or wood.
 *
 * In the game `src/ui/runecut-dress.ts` lays these over a window in the
 * interface's layer; a box on this page is in the page's flow and scrolls
 * with it, so the pictures are canvases inside the box: the slab under its
 * content, the frame over its edge and out by the frame's reach, the niche in
 * its title. Each is painted again when the box changes size, once the change
 * has stopped; until then the last picture is stretched to the box (src/account.css).
 */

/** The window whose dress the boxes wear unless told otherwise. */
const WINDOW = 'faith';
/** The Faith window's frame band, which the page's stylesheet starts from. */
export const FAITH_RIM = FRAME_RIM[frameFor(WINDOW)] ?? 16;
/** How long a resize has to have stopped for before the box is painted again, in ms (as the game's `Dressed`). */
const SETTLE_MS = 150;

const layer = (cls: string): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  return c;
};

/** Dress a box as the Faith window. Its title's head (`.win-head`) takes the niche. */
export function dressFaith(box: HTMLElement): void {
  dressAs(box, () => WINDOW);
}

/**
 * Dress a box as the window `which` names: its slab, its frame and the rune in
 * its niche, all with that window's seed. Asked again whenever the box's class
 * changes, so a box that becomes another window's (the creator, which wears
 * the Trades window's dress) is painted again as that window at once.
 */
export function dressAs(box: HTMLElement, which: () => string): void {
  const plate = layer('fb-plate');
  const frame = layer('fb-frame');
  const niche = layer('fb-niche');
  box.prepend(plate);
  box.append(frame);
  box.querySelector('.win-head')?.prepend(niche);

  let size = '';
  let worn = '';
  const paint = (): void => {
    const win = which();
    const kind = frameFor(win);
    const rim = FRAME_RIM[kind] ?? 16;
    const reach = reachOf(kind);
    const seed = seedOf(win);
    const o: ArtOpts = { seed, night: false, side: sideOf(seed), rim, frame: kind };
    if (win !== worn) {
      worn = win;
      box.style.setProperty('--rim', `${rim}px`);
      box.style.setProperty('--reach', `${reach}px`);
      const k = window.devicePixelRatio || 1;
      niche.width = Math.ceil(NICHE_W * k);
      niche.height = Math.ceil(NICHE_H * k);
      niche.style.width = `${NICHE_W}px`;
      niche.style.height = `${NICHE_H}px`;
      const gn = niche.getContext('2d');
      if (gn) {
        gn.setTransform(k, 0, 0, k, 0, 0);
        paintNiche(gn, runeFor(win), o, k);
      }
    }
    const w = box.offsetWidth, h = box.offsetHeight;
    const k = window.devicePixelRatio || 1;
    if (!w || !h || `${win}:${w}x${h}@${k}` === size) return;
    size = `${win}:${w}x${h}@${k}`;
    const fit = (c: HTMLCanvasElement, cw: number, ch: number): CanvasRenderingContext2D | null => {
      c.width = Math.ceil(cw * k);
      c.height = Math.ceil(ch * k);
      const g = c.getContext('2d');
      g?.setTransform(k, 0, 0, k, 0, 0);
      return g;
    };
    const gp = fit(plate, w, h);
    if (gp) paintPlate(gp, w, h, o);
    const gf = fit(frame, w + 2 * reach, h + 2 * reach);
    if (gf) {
      gf.translate(reach, reach);
      paintFrame(gf, w, h, kind, { seed, night: false, rim });
    }
    box.classList.add('dressed');
  };
  paint();
  let due: ReturnType<typeof setTimeout> | null = null;
  const later = (): void => {
    if (due) clearTimeout(due);
    due = setTimeout(() => {
      due = null;
      paint();
    }, size ? SETTLE_MS : 0);
  };
  new ResizeObserver(later).observe(box);
  // Another window's dress: painted again straight away, and again once the box has settled at its new size.
  new MutationObserver(() => {
    if (which() !== worn) {
      paint();
      later();
    }
  }).observe(box, { attributes: true, attributeFilter: ['class'] });
}
