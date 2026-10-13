import type { Game } from '../game/game';
import { uiPoint } from './screen';

/**
 * The job in hand, as a ring round the mouse pointer.
 *
 * It reads what the action bar reads (`Game.action`, its `elapsed` over its
 * `duration`), so the two can never disagree. A fight's go is a swing or a
 * draw, so in a fight it is the swing timer: one ring a blow, filling from
 * empty as each blow begins.
 *
 * Shown only while a mouse or a pen hovers over the island itself: never on a
 * touch screen, where there is no pointer to put it round, and never over a
 * window, a bar or a menu, where the pointer is reading rather than aiming.
 * It stands under every window, so a window beside the pointer covers it
 * rather than the other way round; takes no clicks; is moved by a transform
 * on every `pointermove`; and is drawn as one SVG arc whose dash offset is
 * the progress.
 */

/** The ring's radius and its stroke, in interface pixels. */
export const RING_RADIUS = 13;
const RING_STROKE = 3;
/** How long the ring takes to fade once its job is over, in milliseconds. */
export const RING_FADE_MS = 350;
/** The jobs whose every go is a blow or a draw, for which the ring is the swing timer. */
const FIGHT_JOBS = new Set(['attack_creature', 'shoot_creature']);

const SVG = 'http://www.w3.org/2000/svg';
const reduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class PointerRing {
  private readonly el: HTMLDivElement;
  private readonly arc: SVGCircleElement;
  private readonly round = 2 * Math.PI * RING_RADIUS;
  /** Whether a hovering pointer is over the island itself. */
  private over = false;
  /** `on` while a job runs, `fading` once it is over, `off` after. */
  private state: 'on' | 'fading' | 'off' = 'off';
  private fadeEnds = 0;
  /** What was last written, so nothing is written twice. */
  private drawn = -1;
  private shown = false;
  private fight = false;

  constructor(root: HTMLElement, private readonly game: Game, private readonly canvas: HTMLCanvasElement) {
    this.el = document.createElement('div');
    this.el.className = 'pointer-ring';
    this.el.hidden = true;
    this.el.setAttribute('aria-hidden', 'true');
    const box = (RING_RADIUS + RING_STROKE) * 2;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(box));
    svg.setAttribute('height', String(box));
    svg.setAttribute('viewBox', `${-box / 2} ${-box / 2} ${box} ${box}`);
    const circle = (cls: string): SVGCircleElement => {
      const c = document.createElementNS(SVG, 'circle');
      c.setAttribute('r', String(RING_RADIUS));
      c.setAttribute('class', cls);
      svg.append(c);
      return c;
    };
    circle('pointer-ring-track');
    this.arc = circle('pointer-ring-arc');
    // From twelve o'clock, clockwise.
    this.arc.setAttribute('transform', 'rotate(-90)');
    this.arc.style.strokeDasharray = String(this.round);
    this.el.append(svg);
    root.append(this.el);

    const move = (e: PointerEvent): void => {
      // A finger has no hover, so nothing to put a ring round.
      const over = e.pointerType !== 'touch' && e.target === this.canvas;
      if (over) {
        const at = uiPoint(e);
        this.el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      }
      if (over !== this.over) {
        this.over = over;
        this.show();
      }
    };
    window.addEventListener('pointermove', move, { capture: true, passive: true });
    window.addEventListener('pointerdown', move, { capture: true, passive: true });
    // Off the page altogether.
    window.addEventListener('pointerout', (e) => {
      if (e.relatedTarget) return;
      this.over = false;
      this.show();
    }, { passive: true });
  }

  /** Called every frame: the job in hand, written only when it has moved. */
  update(now: number): void {
    const a = this.game.action;
    const wanted = this.game.settings.pointerRing;
    if (wanted && a && a.state === 'performing') {
      if (this.state !== 'on') {
        this.state = 'on';
        this.el.classList.remove('pointer-ring-done');
      }
      const fight = FIGHT_JOBS.has(a.def.id);
      if (fight !== this.fight) {
        this.fight = fight;
        this.el.classList.toggle('pointer-ring-swing', fight);
      }
      this.draw(Math.max(0, Math.min(1, a.elapsed / a.duration)));
    } else if (this.state === 'on') {
      // Over: full, then gone. At once with the setting off, or with less motion asked for.
      const still = !wanted || reduced() || this.game.settings.graphics === 'fast';
      this.draw(1);
      this.state = still ? 'off' : 'fading';
      this.fadeEnds = now + RING_FADE_MS;
      if (!still) this.el.classList.add('pointer-ring-done');
    } else if (this.state === 'fading' && now >= this.fadeEnds) {
      this.state = 'off';
      this.el.classList.remove('pointer-ring-done');
    }
    this.show();
  }

  /** The arc at this much of the way round, to a quarter of a pixel. */
  private draw(p: number): void {
    const off = Math.round(this.round * (1 - p) * 4) / 4;
    if (off === this.drawn) return;
    this.drawn = off;
    this.arc.style.strokeDashoffset = String(off);
  }

  private show(): void {
    const shown = this.over && this.state !== 'off';
    if (shown === this.shown) return;
    this.shown = shown;
    this.el.hidden = !shown;
  }
}
