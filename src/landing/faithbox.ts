import { NICHE_H, NICHE_W, paintFrame, paintNiche, paintPlate, reachOf, seedOf, sideOf, type ArtOpts } from '../ui/runecut-art';
import { FRAME_RIM, frameFor } from '../ui/runecut-frames';
import { runeFor } from '../ui/theme';

/**
 * The Faith window's dress, on a box of the landing page: its slab, its frame
 * of marble, pearl and sea glass, and the crescent in the niche at the head of
 * its title, painted by Runecut's own painters (`src/ui/runecut-art.ts`,
 * `src/ui/runecut-frames.ts`) with the Faith window's own seed, so the box
 * and the window in the game are the same piece of stone.
 *
 * In the game `src/ui/runecut-dress.ts` lays these over a window in the
 * interface's layer; a box on this page is in the page's flow and scrolls
 * with it, so the pictures are canvases inside the box: the slab under its
 * content, the frame over its edge and out by the frame's reach, the niche in
 * its title. Each is painted again when the box changes size, once the change
 * has stopped; until then the last picture is stretched to the box (src/account.css).
 */

/** The window whose dress this is. */
const WINDOW = 'faith';
/** The frame it wears, its band's width and how far it stands out past the box. */
const KIND = frameFor(WINDOW);
export const FAITH_RIM = FRAME_RIM[KIND] ?? 16;
const REACH = reachOf(KIND);
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
  const seed = seedOf(WINDOW);
  const o: ArtOpts = { seed, night: false, side: sideOf(seed), rim: FAITH_RIM, frame: KIND };
  const plate = layer('fb-plate');
  const frame = layer('fb-frame');
  const niche = layer('fb-niche');
  box.style.setProperty('--rim', `${FAITH_RIM}px`);
  box.style.setProperty('--reach', `${REACH}px`);
  box.prepend(plate);
  box.append(frame);
  box.querySelector('.win-head')?.prepend(niche);

  let size = '';
  const paint = (): void => {
    const w = box.offsetWidth, h = box.offsetHeight;
    const k = window.devicePixelRatio || 1;
    if (!w || !h || `${w}x${h}@${k}` === size) return;
    size = `${w}x${h}@${k}`;
    const fit = (c: HTMLCanvasElement, cw: number, ch: number): CanvasRenderingContext2D | null => {
      c.width = Math.ceil(cw * k);
      c.height = Math.ceil(ch * k);
      const g = c.getContext('2d');
      g?.setTransform(k, 0, 0, k, 0, 0);
      return g;
    };
    const gp = fit(plate, w, h);
    if (gp) paintPlate(gp, w, h, o);
    const gf = fit(frame, w + 2 * REACH, h + 2 * REACH);
    if (gf) {
      gf.translate(REACH, REACH);
      paintFrame(gf, w, h, KIND, { seed, night: false, rim: FAITH_RIM });
    }
    box.classList.add('dressed');
  };
  const gn = (() => {
    niche.width = Math.ceil(NICHE_W * (window.devicePixelRatio || 1));
    niche.height = Math.ceil(NICHE_H * (window.devicePixelRatio || 1));
    niche.style.width = `${NICHE_W}px`;
    niche.style.height = `${NICHE_H}px`;
    return niche.getContext('2d');
  })();
  if (gn) {
    const k = window.devicePixelRatio || 1;
    gn.setTransform(k, 0, 0, k, 0, 0);
    paintNiche(gn, runeFor(WINDOW), o, k);
  }
  paint();
  let due: ReturnType<typeof setTimeout> | null = null;
  new ResizeObserver(() => {
    if (due) clearTimeout(due);
    due = setTimeout(() => {
      due = null;
      paint();
    }, size ? SETTLE_MS : 0);
  }).observe(box);
}
