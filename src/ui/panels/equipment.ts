import { ACTION_BY_ID } from '../../game/actions';
import { emotePose } from '../../game/emotes';
import type { Game } from '../../game/game';
import { SLOTS, slotOf, WEAPON_BY_ID, type Slot } from '../../game/gear';
import { itemName } from '../../game/items';
import { DEFAULT_LOOK } from '../../game/look';
import { gearFrom, wornWire } from '../../game/worn';
import { drawFigure, figureJoint, onScreen, viewOf, type FigurePose, type V3 } from '../../render/figure';
import { makeDraggable, makeDropZone, type DragPayload } from '../dragdrop';
import { EMPTY_SAYS, equipReport, fitsSlot, pc, type EquipReport, type ShelfView, type SkillView, type Stat } from '../equipment';
import type { UIWindow } from '../windows';

/**
 * Equipment: what you have on, on a figure of you, and what it makes of you
 * in a fight.
 *
 * Along the top, what is in your hands, your stance, and four plaques: a
 * blow, how often it lands, how much of a blow taken gets through, and how
 * much your swings are slowed.
 *
 * On the left, you on a turntable, in everything you wear, with the nine
 * places round you as sockets: the five a blow lands on down your left, what
 * is in your hands, your belt and your jewel down your right, each tied to
 * where it sits on the body. Drag a thing onto its socket or onto you to put
 * it on (from this window's shelf or the pack), or a socket's thing back to
 * the shelf to take it off; a click does the same. Under you, the shelf: what
 * in the pack could go on, each with what it would do in its place and what
 * else it would move.
 *
 * On the right, three tabs: Offence (a blow: its damage, time, chance to
 * land and be critical, reach, and what it does a second, each with what it
 * came from), Defence (a blow taken step by step, where one lands and what is
 * turned there, what of each kind gets through, and what it all costs to
 * carry), and Skills (each skill the fight reads, how far along, and what it
 * does for you now and at its next level).
 *
 * The numbers are worked out in `src/ui/equipment.ts`, off the rules.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** Where on the body each place's leader line ends, in the body's own units (`figureJoint`). */
const SLOT_BONE: Record<Slot, [string, V3]> = {
  head: ['head', [0, 0, 1.2]],
  chest: ['chest', [0, 0, 0.6]],
  arms: ['arm0', [0, 0, -2.2]],
  legs: ['knee0', [0, 0, -1.4]],
  feet: ['ankle0', [0, 0, -0.4]],
  weapon: ['wrist1', [0, 0, -0.6]],
  offhand: ['wrist0', [0, 0, -0.6]],
  belt: ['chest', [0, 0, -2.6]],
  jewel: ['neck', [0, 0, 0]],
};
/** Which side each socket stands on: the places a blow lands on down the left, the rest (hands, belt, jewel) down the right. */
const LEFT: Slot[] = ['head', 'chest', 'arms', 'legs', 'feet'];

/** How much of the stage's height the body stands in, and how tall it may be against the gap between the sockets. */
const BODY_SHARE = 0.74;
const WIDE_SHARE = 1.45;
const FEET_UP = 30;
/** The most frames a second the figure is drawn at. */
const FIGURE_FPS = 30;
/** How long the hop and a socket's seating take when something goes on, seconds. */
const SEAT_SECS = 0.9;
/** At or under this width (CSS px) the tabs go under the figure and the shelf under them. */
const NARROW = 520;
/** The least the shelf is given beside the tabs, CSS px, however short the window. */
const SHELF_LEAST = 150;

/** Small pictures of each place, in a 24 × 24 box, drawn in `currentColor`; a weapon by its family. */
const GLYPH: Record<string, string> = {
  head: '<path d="M4.5 15 C4.5 8 8 4.5 12 4.5 S19.5 8 19.5 15 V18 H15.5 V14 H8.5 V18 H4.5 Z"/><path d="M12 9 V15" class="eq-g-line"/>',
  chest: '<path d="M6 5 L9.5 4 Q12 6.5 14.5 4 L18 5 L19.5 9 L17.5 10 V19.5 Q12 21 6.5 19.5 V10 L4.5 9 Z"/><path d="M8.5 13 H15.5 M8.5 16 H15.5" class="eq-g-line"/>',
  arms: '<path d="M7 4.5 H14 L16.5 12 L15 19.5 H9.5 L8.5 12 Z"/><path d="M9 9 H15 M9.5 14.5 H15.5" class="eq-g-line"/>',
  legs: '<path d="M7 4 H17 L16.5 20 H13 L12 10 L11 20 H7.5 Z"/><path d="M7.5 8 H16.5" class="eq-g-line"/>',
  feet: '<path d="M8 4 H13 V13 L19.5 15.5 Q20.5 19.5 18 19.5 H5.5 Q4.5 19.5 4.8 17.5 L7.5 13 Z"/><path d="M7.5 13 H13" class="eq-g-line"/>',
  offhand: '<path d="M12 3.5 L19.5 6 V11.5 Q19.5 17.5 12 20.5 Q4.5 17.5 4.5 11.5 V6 Z"/><circle cx="12" cy="11.5" r="2.2" class="eq-g-line"/>',
  belt: '<path d="M3 9.5 H21 V14.5 H3 Z"/><rect x="9.5" y="8" width="5" height="8" rx="1" class="eq-g-line"/>',
  jewel: '<path d="M12 4 L17.5 9 L12 20 L6.5 9 Z"/><path d="M6.5 9 H17.5 M9.5 9 L12 4 L14.5 9 L12 20" class="eq-g-line"/>',
  swords: '<path d="M17.5 3.5 L20.5 3.5 L20.5 6.5 L10 17 L7 14 Z"/><path d="M5.5 12.5 L11.5 18.5 M7 17 L4 20" class="eq-g-line"/>',
  axes: '<path d="M7 20.5 L15.5 6" class="eq-g-line"/><path d="M12.5 4 Q20 3.5 20.5 11 Q17 10.5 13.5 9.5 Z"/>',
  mauls: '<path d="M8 20.5 L14.5 9.5" class="eq-g-line"/><path d="M11 3.5 L20.5 9 L17.5 14 L8 8.5 Z"/>',
  knives: '<path d="M16.5 4 Q20 7 14.5 13 L11 9.5 Z"/><path d="M11 9.5 L14.5 13 M12.5 11.5 L6 18" class="eq-g-line"/>',
  polearms: '<path d="M5 20.5 L16.5 9" class="eq-g-line"/><path d="M15 4 L20.5 3.5 L20 9 L17 10.5 L13.5 7 Z"/>',
  archery: '<path d="M7 3.5 Q19 12 7 20.5" class="eq-g-line"/><path d="M7 3.5 V20.5 M4 12 H17 L14.5 10 M17 12 L14.5 14" class="eq-g-line"/>',
  throwing: '<path d="M12 3.5 L14 10 L20.5 12 L14 14 L12 20.5 L10 14 L3.5 12 L10 10 Z"/>',
  fist: '<path d="M7 10 Q7 6.5 10 6.5 H15 Q18 6.5 18 10 V15 Q18 19.5 13 19.5 H11 Q7 19.5 7 15 Z"/><path d="M10 6.5 V11 M13 6.5 V11 M16 7 V11" class="eq-g-line"/>',
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A place's picture, or a weapon's by its family. */
function glyph(slot: Slot, id?: string): SVGSVGElement {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const w = id ? WEAPON_BY_ID.get(id) : undefined;
  s.innerHTML = slot === 'weapon' ? GLYPH[w ? (w.thrown ? 'throwing' : w.kind) : 'fist'] ?? GLYPH.swords : GLYPH[slot];
  return s;
}

/** A place as the shelf names it. */
const placeName = (slot: Slot): string => (slot === 'weapon' ? 'hand' : slot === 'offhand' ? 'off hand' : slot);

type Tab = 'offence' | 'defence' | 'skills';

interface Socket {
  slot: Slot;
  box: HTMLButtonElement;
  pic: HTMLSpanElement;
  ql: HTMLSpanElement;
  /** The uid in it as last drawn, to see a change come. */
  uid: number | null;
}

export class EquipmentPanel {
  private readonly heads = new Map<string, { box: HTMLElement; num: HTMLElement; value: number }>();
  private readonly title: HTMLDivElement;
  private readonly kind: HTMLSpanElement;
  private readonly stage: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly sockets = new Map<Slot, Socket>();
  private readonly shelfBox: HTMLElement;
  private readonly shelf: HTMLDivElement;
  private readonly shelfHead: HTMLDivElement;
  private readonly stances: HTMLDivElement;
  private readonly stanceSays: HTMLSpanElement;
  private readonly tabs = new Map<Tab, { btn: HTMLButtonElement; pane: HTMLDivElement }>();
  private tab: Tab = 'offence';
  private report: EquipReport | null = null;
  /** The place picked on the figure: the shelf shows what fits there, and its head says what is in it. */
  private picked: Slot | null = null;
  private facing = 0;
  /** When something last went on or came off, for the hop. */
  private seatAt = -Infinity;
  private frame = 0;
  private lastFigure = 0;
  private drawn = '';
  /** Whether the last draw was made with the window open: only a change seen while it is open is played out. */
  private seen = false;
  private next = 0;
  private readonly still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('eq-body');
    const root = el('div', 'eq');
    win.body.append(root);

    /* ---- along the top: what is in your hands, your stance, and the four numbers that say how a fight goes ---- */
    const top = el('header', 'eq-top');
    const id = el('div', 'eq-id');
    this.title = el('div', 'eq-title');
    this.kind = el('span', 'eq-kind');
    this.stances = el('div', 'eq-stances');
    this.stances.setAttribute('role', 'radiogroup');
    this.stances.setAttribute('aria-label', 'Stance');
    this.stanceSays = el('span', 'eq-stance-says');
    const stanceRow = el('div', 'eq-stance-row');
    stanceRow.append(this.stances, this.stanceSays);
    id.append(this.title, this.kind, stanceRow);
    const heads = el('div', 'eq-heads');
    for (const key of ['damage', 'lands', 'through', 'slowed']) {
      const box = el('div', `eq-head eq-head-${key}`);
      const num = el('b', 'eq-head-num');
      box.append(num, el('span', 'eq-head-label'));
      heads.append(box);
      this.heads.set(key, { box, num, value: NaN });
    }
    top.append(id, heads);

    /* ---- you, on a turntable, with the sockets round you ---- */
    const main = el('div', 'eq-main');
    const doll = el('section', 'eq-doll');
    this.stage = el('div', 'eq-stage');
    this.canvas = el('canvas', 'eq-canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    const plinth = el('div', 'eq-plinth');
    const colL = el('div', 'eq-col eq-col-l');
    const colR = el('div', 'eq-col eq-col-r');
    for (const slot of SLOTS) {
      const box = el('button', `eq-socket eq-socket-${slot}`);
      box.type = 'button';
      box.dataset.slot = slot;
      const pic = el('span', 'eq-pic');
      const ql = el('span', 'eq-ql');
      box.append(el('span', 'eq-wear'), pic, ql, el('span', 'eq-up', '▲'), el('span', 'eq-socket-name', slot === 'weapon' ? 'Hand' : slot === 'offhand' ? 'Off hand' : slot[0].toUpperCase() + slot.slice(1)));
      box.addEventListener('click', () => this.pick(slot));
      box.addEventListener('dblclick', () => this.takeOff(slot));
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          this.takeOff(slot);
        }
      });
      // A thing in it can be carried back to the shelf to take it off.
      makeDraggable(box, () => {
        const it = this.game.worn(slot);
        return { uid: it?.uid ?? -1, from: 'inventory', name: it ? itemName(it) : '' };
      });
      makeDropZone(box, (p) => this.fits(p, slot), (p) => this.putOn(p.uid));
      (LEFT.includes(slot) ? colL : colR).append(box);
      this.sockets.set(slot, { slot, box, pic, ql, uid: null });
    }
    // Turn the figure: a button at each side of its plinth, or drag it.
    const turn = (cls: string, text: string, label: string, by: number): HTMLButtonElement => {
      const b = el('button', `eq-turn-btn ${cls}`, text);
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => this.spin(by));
      return b;
    };
    this.stage.append(plinth, this.canvas, colL, colR, turn('eq-turn-l', '↺', 'Turn the figure left', 1), turn('eq-turn-r', '↻', 'Turn the figure right', -1));
    // Let go of a thing over you and it goes on wherever it is worn.
    makeDropZone(this.canvas, (p) => this.fits(p), (p) => this.putOn(p.uid));
    let downX: number | null = null;
    this.canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; });
    this.canvas.addEventListener('pointermove', (e) => {
      if (downX === null || !(e.buttons & 1)) return;
      if (Math.abs(e.clientX - downX) > 28) {
        this.spin(e.clientX > downX ? -1 : 1);
        downX = e.clientX;
      }
    });
    const up = (): void => { downX = null; };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointerleave', up);

    /* ---- the shelf: what in the pack could go on ---- */
    this.shelfBox = el('section', 'eq-shelf-box');
    this.shelfHead = el('div', 'eq-shelf-head');
    this.shelf = el('div', 'eq-shelf');
    this.shelf.setAttribute('role', 'list');
    this.shelfBox.append(this.shelfHead, this.shelf);
    // A thing worn, carried here, comes off.
    makeDropZone(this.shelfBox, (p) => p.from === 'inventory' && this.game.isEquipped(p.uid), (p) => this.takeOffUid(p.uid));
    this.shelf.addEventListener('scroll', () => this.fade(), { passive: true });
    doll.append(this.stage, this.shelfBox);

    /* ---- the tabs ---- */
    const side = el('section', 'eq-side');
    const bar = el('div', 'eq-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Equipment');
    const panes = el('div', 'eq-panes');
    const order: Array<[Tab, string]> = [['offence', 'Offence'], ['defence', 'Defence'], ['skills', 'Skills']];
    for (const [t, label] of order) {
      const btn = el('button', 'eq-tab', label);
      btn.type = 'button';
      btn.id = `eq-tab-${t}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', `eq-pane-${t}`);
      btn.addEventListener('click', () => this.show(t));
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = order.findIndex(([k]) => k === t);
        const to = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length][0];
        this.show(to);
        this.tabs.get(to)?.btn.focus();
      });
      const pane = el('div', 'eq-pane');
      pane.id = `eq-pane-${t}`;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', btn.id);
      bar.append(btn);
      panes.append(pane);
      this.tabs.set(t, { btn, pane });
    }
    side.append(bar, panes);

    main.append(doll, side);
    root.append(top, main);

    // Narrow, the shelf is a row under you that scrolls sideways, and the tabs under it; wide, the shelf is as tall as the window shows under you.
    const fit = (): void => {
      const narrow = root.clientWidth > 0 && root.clientWidth <= NARROW;
      if (narrow !== root.classList.contains('eq-narrow')) {
        root.classList.toggle('eq-narrow', narrow);
      }
      if (narrow) this.shelf.style.removeProperty('max-height');
      else {
        const shows = win.body.clientHeight - (this.shelf.offsetTop - win.body.offsetTop) - 22;
        this.shelf.style.maxHeight = `${Math.max(SHELF_LEAST, shows)}px`;
      }
      this.fade();
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(root);

    this.show('offence');
    win.onOpen = () => {
      this.refresh(true);
      this.loop();
    };
    for (const ev of ['stats', 'inventory', 'skill', 'action'] as const) game.events.on(ev as 'stats', () => this.soon());
    this.refresh(true);
  }

  /** Drawn again at the next update, not at once: one go can change the pack and the body in one breath. */
  private soon(): void {
    this.next = 0;
  }

  /** Called every frame; the numbers a few times a second while open. */
  update(now: number): void {
    if (!this.win.isOpen || now < this.next) return;
    this.next = now + 250;
    this.refresh(false);
  }

  /* ---- doing ---------------------------------------------------------------------------- */

  /** Whether what is being carried may be let go of here: something worn or held and not on, into its own place when one is named. */
  private fits(p: DragPayload, slot?: Slot): boolean {
    if (p.from !== 'inventory') return false;
    const it = this.game.inventory.get(p.uid);
    if (!it) return false;
    if (!slotOf(it.id) || (slot && !fitsSlot(it.id, slot))) return false;
    return !this.game.isEquipped(it.uid);
  }

  private ask(action: 'equip' | 'unequip', uid: number): void {
    const def = ACTION_BY_ID.get(action);
    if (!def) return;
    this.game.requestAction(def, { kind: 'item', uid }, 1);
    this.soon();
  }

  private putOn(uid: number): void {
    const it = this.game.inventory.get(uid);
    if (!it || this.game.isEquipped(uid)) return;
    this.ask('equip', uid);
  }

  private takeOff(slot: Slot): void {
    const it = this.game.worn(slot);
    if (it) this.ask('unequip', it.uid);
  }

  private takeOffUid(uid: number): void {
    if (this.game.isEquipped(uid)) this.ask('unequip', uid);
  }

  private pick(slot: Slot): void {
    this.picked = this.picked === slot ? null : slot;
    this.drawn = '';
    this.refresh(true);
  }

  private spin(by: number): void {
    this.facing = (((this.facing + by) % 8) + 8) % 8;
  }

  private show(t: Tab): void {
    this.tab = t;
    for (const [k, { btn, pane }] of this.tabs) {
      const on = k === t;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      btn.classList.toggle('eq-tab-on', on);
      pane.hidden = !on;
    }
    this.drawn = '';
    if (this.report) this.refresh(true);
  }

  /** The shelf's foot fades while there is more of it under the fold. */
  private fade(): void {
    const s = this.shelf;
    this.shelfBox.classList.toggle('eq-shelf-more', s.scrollHeight - s.scrollTop - s.clientHeight > 6);
    this.shelfBox.classList.toggle('eq-shelf-more-x', s.scrollWidth - s.scrollLeft - s.clientWidth > 6);
  }

  /* ---- drawing -------------------------------------------------------------------------- */

  refresh(force: boolean): void {
    if (!this.win.isOpen && !force) return;
    const r = equipReport(this.game);
    this.report = r;
    // A change is played out only when the window was open to see it come, not when it opens on what changed while shut.
    const live = this.seen && this.win.isOpen && !this.still;
    this.drawTop(r, live);
    this.drawSockets(r, live);
    this.drawStances(r);
    this.seen = this.win.isOpen;
    const sig = JSON.stringify([this.tab, this.picked, r.offence, r.chain, r.defence, r.burden, r.through, r.skills, r.weapon, r.slots.map((s) => s.label),
      r.shelf.map((s) => [s.item.uid, s.main, s.effects, s.why, s.item.ql, s.item.dmg])]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.drawShelf(r);
    const pane = this.tabs.get(this.tab)?.pane;
    if (!pane) return;
    if (this.tab === 'offence') this.drawOffence(pane, r);
    else if (this.tab === 'defence') this.drawDefence(pane, r);
    else this.drawSkills(pane, r);
  }

  private drawTop(r: EquipReport, live: boolean): void {
    this.title.textContent = r.weapon.name;
    const w = this.game.worn('weapon');
    this.kind.textContent = `${r.weapon.kind}${w ? ` · QL ${w.ql.toFixed(0)}` : ''} · a ${r.weapon.blow === 'cut' ? 'cutting' : r.weapon.blow === 'pierce' ? 'piercing' : 'crushing'} blow`;
    for (const s of r.head) {
      const h = this.heads.get(s.key);
      if (!h) continue;
      h.num.textContent = s.says;
      (h.box.querySelector('.eq-head-label') as HTMLElement).textContent = s.label;
      // A number that moved floats what it moved by, green for the better.
      if (live && Number.isFinite(h.value) && Math.abs(s.value - h.value) > 1e-6) {
        const d = s.value - h.value;
        const better = s.key === 'through' || s.key === 'slowed' ? d < 0 : d > 0;
        const float = el('span', `eq-float ${better ? 'eq-float-good' : 'eq-float-bad'}`,
          s.key === 'damage' ? `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}` : `${d > 0 ? '+' : '−'}${pc(Math.abs(d))}`);
        float.addEventListener('animationend', () => float.remove());
        h.box.append(float);
      }
      h.value = s.value;
    }
  }

  private drawSockets(r: EquipReport, live: boolean): void {
    const now = performance.now() / 1000;
    for (const v of r.slots) {
      const s = this.sockets.get(v.slot);
      if (!s) continue;
      const uid = v.item?.uid ?? null;
      if (live && uid !== s.uid) {
        // Something went on or came off: the socket takes it with a ring, and you hop.
        s.box.classList.remove('eq-seat');
        void s.box.offsetWidth;
        s.box.classList.add('eq-seat');
        this.seatAt = now;
      }
      s.uid = uid;
      const bare = !v.item && v.struck !== null;
      s.box.classList.toggle('eq-full', !!v.item);
      s.box.classList.toggle('eq-bare', bare);
      s.box.classList.toggle('eq-picked', this.picked === v.slot);
      s.box.classList.toggle('eq-worn-out', v.wear >= 0.75);
      s.box.classList.toggle('eq-upgrade', v.upgrade);
      s.box.draggable = !!v.item;
      s.box.style.setProperty('--eq-tint', v.tint ?? 'var(--eq-metal)');
      s.box.style.setProperty('--eq-wear', String(1 - v.wear));
      s.pic.replaceChildren(glyph(v.slot, v.item?.id));
      // Its QL; on a bare place a blow lands on, how often one lands there.
      s.ql.textContent = v.item ? v.item.ql.toFixed(0) : bare ? `${Math.round((v.struck ?? 0) * 100)}%` : '';
      const what = v.label ?? EMPTY_SAYS[v.slot];
      const tip = `${v.name}: ${what}${v.item ? `, QL ${v.item.ql.toFixed(1)}, ${v.wearSays}` : ''}${v.does ? `. ${v.does}` : ''}`
        + `${v.struck !== null ? `. A blow lands here ${Math.round(v.struck * 100)}% of the time` : ''}${v.upgrade ? '. Your pack has something that does better here' : ''}.`;
      s.box.title = tip;
      s.box.setAttribute('aria-label', `${tip}${v.item ? ' Press Delete to take it off.' : ''}`);
    }
  }

  private drawStances(r: EquipReport): void {
    this.stanceSays.textContent = 'damage dealt / taken';
    if (this.stances.dataset.sig === r.stance.now) return;
    this.stances.dataset.sig = r.stance.now;
    this.stances.replaceChildren(...r.stance.all.map((s) => {
      const b = el('button', `eq-stance${s.id === r.stance.now ? ' eq-stance-on' : ''}`);
      b.append(el('span', 'eq-stance-name', s.name), el('span', 'eq-stance-by', `×${+s.dealt.toFixed(2)} / ×${+s.taken.toFixed(2)}`));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.id === r.stance.now));
      b.title = `${s.name}: ×${+s.dealt.toFixed(2)} damage dealt, ×${+s.taken.toFixed(2)} damage taken`;
      b.addEventListener('click', () => {
        // Round to it, a step at a time, as the key does, so the island hears each.
        for (let i = 0; i < 3 && this.game.settings.fightStance !== s.id; i++) this.game.cycleStance();
      });
      return b;
    }));
  }

  private drawShelf(r: EquipReport): void {
    const v = this.picked ? r.slots.find((x) => x.slot === this.picked) : null;
    const list = this.picked ? r.shelf.filter((s) => s.slot === this.picked) : r.shelf;
    this.shelfHead.replaceChildren();
    if (v) {
      // The place picked: what is in it, what it does, a button to take it off, and the way back to everything.
      const what = el('div', 'eq-shelf-picked');
      what.append(el('span', 'eq-shelf-slot', v.name), el('b', '', v.label ?? EMPTY_SAYS[v.slot]));
      // What it does here, and under it its QL and what its wear costs it.
      if (v.does) what.append(el('span', 'eq-shelf-does', `${v.does}.`));
      if (v.item) what.append(el('span', 'eq-shelf-does', `QL ${v.item.ql.toFixed(0)}, ${v.wearSays}.`));
      const acts = el('div', 'eq-shelf-acts');
      if (v.item) {
        const off = el('button', 'eq-pill', 'Take off');
        off.type = 'button';
        off.addEventListener('click', () => this.takeOff(v.slot));
        acts.append(off);
      }
      const all = el('button', 'eq-pill', 'Show all');
      all.type = 'button';
      all.addEventListener('click', () => this.pick(v.slot));
      acts.append(all);
      this.shelfHead.append(what, acts);
    } else {
      this.shelfHead.append(el('b', '', 'In your pack'), el('span', 'eq-shelf-n', `${list.length} to put on · drag onto a socket or onto you`));
    }
    if (!list.length) {
      this.shelf.replaceChildren(el('div', 'eq-shelf-none', this.picked ? `Nothing in your pack goes on your ${placeName(this.picked)}.` : 'Nothing in your pack is worn or held.'));
    } else this.shelf.replaceChildren(...list.map((s) => this.shelfCard(s)));
    this.fade();
  }

  private shelfCard(s: ShelfView): HTMLElement {
    const card = el('button', `eq-card${s.why ? ' eq-card-no' : ''}`);
    card.type = 'button';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--eq-tint', s.tint ?? 'var(--eq-metal)');
    const pic = el('span', 'eq-card-pic');
    pic.append(glyph(s.slot, s.item.id));
    const text = el('span', 'eq-card-text');
    const name = el('span', 'eq-card-name');
    name.append(el('b', '', s.label), el('span', 'eq-card-ql', ` QL ${s.item.ql.toFixed(0)} · ${placeName(s.slot)} · ${s.kg.toFixed(1)} kg`));
    text.append(name);
    // What it does in its place, and beside it what else moves.
    const fx = el('span', 'eq-card-fx');
    if (s.main) fx.append(el('span', `eq-card-main ${s.main.better ? 'eq-good' : 'eq-bad'}`, s.main.text));
    for (const e of s.effects) fx.append(el('span', `eq-fx ${e.better ? 'eq-fx-good' : 'eq-fx-bad'}`, e.text));
    if (fx.childElementCount) text.append(fx);
    if (s.why) text.append(el('span', 'eq-card-why', s.why));
    card.append(pic, text);
    const says = [s.main?.text, ...s.effects.map((e) => e.text)].filter(Boolean).join(', ');
    card.title = s.why ?? `${s.label}, QL ${s.item.ql.toFixed(1)}: click or drag to put it on${says ? `. ${says}` : ''}.`;
    card.setAttribute('aria-label', card.title);
    card.disabled = !!s.why;
    card.addEventListener('click', () => this.putOn(s.item.uid));
    makeDraggable(card, { uid: s.item.uid, from: 'inventory', name: s.label });
    return card;
  }

  /** A number's row: what, how much, and under it the things it came from, a line each. */
  private statRow(s: Stat): HTMLElement {
    const row = el('div', `eq-stat eq-stat-${s.key}`);
    row.append(el('span', 'eq-stat-label', s.label), el('b', 'eq-stat-val', s.says));
    if (s.lines?.length) {
      const ul = el('ul', 'eq-stat-lines');
      for (const l of s.lines) ul.append(el('li', '', l));
      row.append(ul);
    }
    return row;
  }

  private drawOffence(pane: HTMLElement, r: EquipReport): void {
    // What the blow is against what it meets, and what else it does.
    const card = el('div', 'eq-weapon');
    const pic = el('span', 'eq-weapon-pic');
    pic.append(glyph('weapon', this.game.worn('weapon')?.id));
    const words = el('div', 'eq-weapon-words');
    words.append(el('b', 'eq-weapon-head', `${r.weapon.blow === 'cut' ? 'A cut' : r.weapon.blow === 'pierce' ? 'A thrust' : 'A crushing blow'} against a hide`),
      el('span', '', `${r.weapon.hides} · no hide ×1`));
    if (r.weapon.side) words.append(el('span', 'eq-weapon-side', `A blow that lands also ${r.weapon.side}.`));
    if (r.weapon.arrows) words.append(el('span', 'eq-weapon-side', r.weapon.arrows));
    card.append(pic, words);
    const rows = el('div', 'eq-stats');
    for (const s of r.offence) rows.append(this.statRow(s));
    pane.replaceChildren(card, rows);
  }

  private drawDefence(pane: HTMLElement, r: EquipReport): void {
    // A blow on its way to you: what each thing takes off, and how much is left after it.
    const chain = el('div', 'eq-chain');
    chain.append(el('div', 'eq-sub', 'A blow on its way to you'));
    let prev = 1;
    for (const [i, st] of r.chain.entries()) {
      const row = el('div', `eq-step${i ? '' : ' eq-step-first'}`);
      const bar = el('span', 'eq-bar eq-bar-step');
      const fill = el('span', 'eq-bar-fill');
      fill.style.width = `${Math.round(st.left * 1000) / 10}%`;
      // What this step took off, left standing as a pale stub beyond what is left.
      const off = el('span', 'eq-bar-off');
      off.style.left = fill.style.width;
      off.style.width = `${Math.max(0, Math.round((prev - st.left) * 1000) / 10)}%`;
      bar.append(off, fill);
      prev = st.left;
      row.append(el('span', 'eq-step-what', st.what), el('span', 'eq-step-took', st.took), bar, el('b', 'eq-step-left', pc(st.left)));
      chain.append(row);
    }
    // Where a blow lands, how often, and what is turned aside there.
    const map = el('div', 'eq-map');
    map.append(el('div', 'eq-sub', 'Where a blow lands'));
    for (const v of r.slots.filter((x) => x.struck !== null)) {
      const row = el('div', `eq-loc${v.soak === null ? ' eq-loc-bare' : ''}`);
      const bar = el('span', 'eq-bar');
      const fill = el('span', 'eq-bar-fill');
      fill.style.width = `${Math.round((v.soak ?? 0) * 100)}%`;
      bar.append(fill);
      row.append(el('span', 'eq-loc-name', v.name), el('span', 'eq-loc-odds', `${Math.round((v.struck ?? 0) * 100)}% of blows`), bar,
        el('span', 'eq-loc-soak', v.soak === null ? 'bare' : `${pc(v.soak)} turned`));
      map.append(row);
    }
    const rows = el('div', 'eq-stats');
    for (const s of r.defence) rows.append(this.statRow(s));
    // Of each kind of blow, what reaches you.
    const thru = el('div', 'eq-thru');
    thru.append(el('div', 'eq-sub', 'Of each kind of blow, what gets through'));
    for (const t of r.through) {
      const row = el('div', 'eq-thru-row');
      const bar = el('span', 'eq-bar eq-bar-thru');
      const fill = el('span', 'eq-bar-fill');
      fill.style.width = `${Math.round(t.share * 1000) / 10}%`;
      bar.append(fill);
      row.append(el('span', 'eq-thru-name', t.name[0].toUpperCase() + t.name.slice(1)), bar, el('b', 'eq-thru-val', pc(t.share)));
      thru.append(row);
    }
    const carry = el('div', 'eq-stats eq-carry');
    carry.append(el('div', 'eq-sub', 'What it costs to carry'));
    for (const s of r.burden) carry.append(this.statRow(s));
    pane.replaceChildren(chain, map, rows, thru, carry);
  }

  private drawSkills(pane: HTMLElement, r: EquipReport): void {
    pane.replaceChildren(el('div', 'eq-sub', 'Now, and at the next level'), ...r.skills.map((s) => this.skillRow(s)));
  }

  private skillRow(s: SkillView): HTMLElement {
    const row = el('div', 'eq-skill');
    const head = el('div', 'eq-skill-head');
    head.append(el('b', '', s.name), el('span', 'eq-skill-level', s.level.toFixed(1)));
    const bar = el('span', 'eq-bar eq-bar-skill');
    const fill = el('span', 'eq-bar-fill');
    fill.style.width = `${Math.round(s.toNext * 100)}%`;
    bar.append(fill);
    bar.title = `${Math.round(s.toNext * 100)}% of the way to ${Math.floor(s.level) + 1}`;
    const gives = el('div', 'eq-gives');
    if (!s.gives.length) gives.append(el('span', 'eq-give-none', 'Moves nothing you have on now.'));
    for (const g of s.gives) {
      const line = el('span', 'eq-give');
      line.append(el('span', 'eq-give-what', g.what), el('b', '', g.now), el('span', 'eq-give-next', g.next ?? ''));
      gives.append(line);
    }
    row.append(head, bar, gives);
    return row;
  }

  /* ---- the figure ----------------------------------------------------------------------- */

  private pose(t: number): FigurePose {
    const p = this.game.player;
    const k = (performance.now() / 1000 - this.seatAt) / SEAT_SECS;
    return {
      phase: t * 6,
      moving: false,
      facing: this.facing,
      swimming: false,
      working: false,
      id: 'equipment-doll',
      look: p.look ?? DEFAULT_LOOK,
      gear: gearFrom(wornWire((slot) => this.game.worn(slot))),
      ...(k >= 0 && k < 1 && !this.still ? { emote: 'hop', emoteT: k } : {}),
    };
  }

  private loop(): void {
    cancelAnimationFrame(this.frame);
    const step = (ms: number): void => {
      if (!this.win.isOpen) return;
      if (ms - this.lastFigure >= 1000 / FIGURE_FPS) {
        this.lastFigure = ms;
        this.drawStage(ms / 1000);
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private drawStage(t: number): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const c = this.canvas;
    const W = this.stage.clientWidth || 300, H = this.stage.clientHeight || 300;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const pose = this.pose(this.still ? 0 : t);
    const view = viewOf(pose.facing);
    // The body between the two columns of sockets: as tall as the stage allows and no wider than the gap.
    const gap = Math.max(80, W - 2 * 64);
    const crown = onScreen(view, figureJoint(pose, 'head', [0, 0, 2.6]));
    const zoom = Math.min(H * BODY_SHARE, gap * WIDE_SHARE) / Math.max(1, -crown[1]);
    const k = (performance.now() / 1000 - this.seatAt) / SEAT_SECS;
    const lift = pose.emote === 'hop' ? emotePose('hop', Math.max(0, Math.min(1, k))).lift * (H / 300) : 0;
    const fx = W / 2, fy = H - FEET_UP * (H / 300) - lift;
    // Leader lines from each socket to where it sits on you, behind the body: a place worn reads in the metal, a bare one faint.
    const stageBox = this.stage.getBoundingClientRect();
    for (const [slot, s] of this.sockets) {
      const [bone, off] = SLOT_BONE[slot];
      const p = onScreen(view, figureJoint(pose, bone, off));
      const bx = fx + p[0] * zoom, by = fy + p[1] * zoom;
      const r = s.box.getBoundingClientRect();
      if (!r.width) continue;
      const sx = (LEFT.includes(slot) ? r.right : r.left) - stageBox.left, sy = r.top + r.height / 2 - stageBox.top;
      const full = s.box.classList.contains('eq-full'), on = this.picked === slot;
      g.beginPath();
      g.moveTo(sx, sy);
      const mx = (sx + bx) / 2;
      g.bezierCurveTo(mx, sy, mx, by, bx, by);
      g.strokeStyle = on ? 'rgba(214, 150, 60, 0.95)' : full ? 'rgba(120, 104, 80, 0.55)' : 'rgba(120, 104, 80, 0.22)';
      g.lineWidth = on ? 1.8 : 1.1;
      g.setLineDash(full || on ? [] : [3, 3]);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(bx, by, on ? 3.2 : 2.2, 0, Math.PI * 2);
      g.fillStyle = on ? 'rgba(214, 150, 60, 1)' : full ? 'rgba(120, 104, 80, 0.8)' : 'rgba(120, 104, 80, 0.35)';
      g.fill();
    }
    drawFigure(g, fx, fy, zoom, pose, { ink: 1.3 });
  }
}
