import { keyName, type Keybinds } from '../game/keybinds';
import { balance, fedWord, NUTRIENTS, NUTRIENT_NAMES, NUTRIENT_NOTES, tableMul } from '../game/nutrition';
import { sailWord, windFrom, windWord } from '../game/wind';
import { FURNITURE_BY_ID } from '../game/furniture';
import { CELLAR_LEVEL, TOP_LEVELS } from '../game/building';
import { seasonLine } from '../world/calendar';
import { metres } from '../world/tiles';
import { CHAR_START, type Game } from '../game/game';
import { itemName } from '../game/items';
import { ACTION_BY_ID } from '../game/actions';
import { BELT_MAX, pinLabel } from '../game/belt';
import type { Renderer } from '../render/renderer';
import { ashore, JOURNAL, nextGoals } from '../game/journal';
import { VERSION } from '../version';
import { updateButton } from './update';
import { esc } from './esc';
import { BACK_SLACK, blowOf, blowWords, COWARD_DRAG, FIGHT_STANCE_NAMES, HEAVY_EVERY, HIDE_NAMES, hideSays, hideTakes, HUNT_REACH, KEEP_OFF, PACK_CALL, stanceSays, swungWith, TARGET_RANGE, THROW_HIT, THROW_REACH, turnsAt } from '../game/fight';
import { HUNT_SIGHT, maxHealth, PLAYER_ATTACKER } from '../game/creatures';
import { consider } from '../game/consider';
import { percent } from '../game/words';
import { feedFill } from '../game/creatureActions';
import { EffectRow } from './effects';
import { TRACK_SHOW } from '../game/tracking';
import type { Tooltip } from './tooltip';

export interface HudCallbacks {
  toggle: (id: string) => void;
  toggleGrid: () => void;
  center: () => void;
  /** Open the list of windows, anchored under the button that asked. */
  windows: (x: number, y: number) => void;
  turn: (step: number) => void;
  /** Press a loop on the belt, aimed at whatever the cursor is on. */
  useLoop: (loop: number) => void;
  /** Whether the selection window has the number keys just now. */
  numbersTaken: () => boolean;
  /** What every key does, so the toolbar can say so and keep saying so. */
  keys: Keybinds;
  /** The one tooltip, for the notes of the row of what is on you (`EffectRow`). */
  tooltip?: Tooltip;
}

interface Bar {
  fill: HTMLDivElement;
  value: HTMLSpanElement;
}

/*
 * Every window there is, in the order the menu lists them.
 *
 * These were thirteen buttons across the top, and with the four view controls
 * and a `New world` nobody wanted that was eighteen — sixteen hundred pixels
 * of toolbar, which on a phone is four screens of sideways scrolling with
 * nothing to say so. They are one button and a list now.
 *
 * The keys are unchanged and the list says what they are, which is the other
 * half of the point: a menu you have to open every time would be a step
 * backwards, and this is where somebody learns the key that means they never
 * have to open it again.
 */
export const WINDOWS: Array<{ label: string; bind: string; id: string }> = [
  { label: 'Inventory', bind: 'win_inventory', id: 'inventory' },
  { label: 'Craft', bind: 'win_craft', id: 'craft' },
  { label: 'Tile', bind: 'win_tile', id: 'tile' },
  { label: 'Skills', bind: 'win_skills', id: 'skills' },
  { label: 'Health', bind: 'win_health', id: 'health' },
  { label: 'Equipment', bind: 'win_equipment', id: 'equipment' },
  { label: 'Trades', bind: 'win_trades', id: 'trades' },
  { label: 'Faith', bind: 'win_faith', id: 'faith' },
  { label: 'Events', bind: 'win_events', id: 'events' },
  { label: 'Map', bind: 'win_map', id: 'map' },
  { label: 'Wildermon', bind: 'win_wildermon', id: 'wildermon' },
  { label: 'Market', bind: 'win_market', id: 'market' },
  { label: 'Journal', bind: 'win_journal', id: 'journal' },
  { label: 'Stores', bind: 'win_stores', id: 'stores' },
  { label: 'Shopping list', bind: 'win_shopping', id: 'shopping' },
  { label: 'Settlement', bind: 'win_deed', id: 'deed' },
  { label: 'Social', bind: 'win_social', id: 'social' },
  // Made, and so listed, only for somebody the island says keeps it.
  { label: 'Island keeper', bind: 'win_keeper', id: 'keeper' },
  { label: 'Settings', bind: 'win_settings', id: 'settings' },
];

/*
 * What is left on the toolbar, which says which key does each of these.
 *
 * It used to say so by spelling the letter out here, which was true right up
 * until the Keys tab let somebody move one. Each button names the *binding*
 * and asks what it currently answers to, so the toolbar cannot go stale.
 *
 * These four stay out where a thumb can reach them because they are not
 * windows: they are how you look at the island, pressed between one glance and
 * the next rather than opened and read.
 */
const BUTTONS: Array<{ label: string; bind?: string; action: (cb: HudCallbacks) => void; id?: string }> = [
  { label: 'Grid', bind: 'grid', action: (cb) => cb.toggleGrid(), id: 'grid' },
  { label: 'Centre', bind: 'centre', action: (cb) => cb.center() },
  { label: '↻ Turn', bind: 'turn_left', action: (cb) => cb.turn(-1) },
  { label: '↺ Turn', bind: 'turn_right', action: (cb) => cb.turn(1) },
];

/** Status bars, the action timer and the toolbar. */
/** 1st, 2nd, 3rd, 4th... for the storey label. */
function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * How often the hud is allowed to redraw itself, in milliseconds. Ten times a
 * second is quicker than anybody reads and a sixth of the work.
 */
const HUD_EVERY = 100;

/** Where the target panel sits from the top when nothing is in its way, and how far under whatever is. */
const TARGET_TOP = 24;
const TARGET_GAP = 8;

/**
 * Enter and Space on one of the hud's buttons press that button and nothing
 * else. Left to reach the window they would also do what the island binds
 * them to -- Enter opens the chat -- and the focus went there before the
 * button was ever pressed, so none of these could be worked from a keyboard.
 */
function keepKeys(el: HTMLElement): void {
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement) e.stopPropagation();
  });
}

export class Hud {
  /** When the hud last drew itself, so it does so a few times a second. */
  private lastAt = -1e9;
  /** What each node was last told to say, so it is not told the same thing twice. */
  private readonly said = new WeakMap<HTMLElement, string>();
  private bars: Record<string, Bar> = {};
  /** Toolbar buttons that name a key, and which binding each one names. */
  private keyed: Array<{ btn: HTMLButtonElement; label: string; bind: string }> = [];
  private binds!: Keybinds;
  private nameEl: HTMLDivElement;
  /** The status panel and the toolbar, which the target panel keeps out from under. */
  private statusEl: HTMLDivElement;
  private toolbarEl: HTMLDivElement;
  /** Bottom and middle: the first-steps card over the action bar, stacked so neither can lie across the other. */
  private stackEl = document.createElement('div');
  private posEl: HTMLDivElement;
  private fpsEl: HTMLDivElement;
  private actionEl: HTMLDivElement;
  private actionLabel: HTMLDivElement;
  private actionFill: HTMLDivElement;
  private queueEl: HTMLDivElement;
  private goBtn: HTMLButtonElement;
  private guideEl: HTMLDivElement;
  private guideTitle: HTMLDivElement;
  private guideBody: HTMLDivElement;
  /** Which goal the guide is showing, so it is only rewritten when it changes. */
  private guideOn = '';
  /** Opens the journal window; filled in by the UI that owns the windows. */
  openJournal: (() => void) | null = null;
  private hintEl: HTMLDivElement;
  private gridBtn: HTMLButtonElement | null = null;
  private compass: HTMLSpanElement;
  private companionEl: HTMLDivElement;
  private gearEl: HTMLDivElement;
  private eatBtn!: HTMLButtonElement;
  private stanceBtn!: HTMLButtonElement;
  /** What you are fighting or have marked: its name, its health, what it is about, and what it is weak to. */
  private targetEl = document.createElement('div');
  private targetName = document.createElement('div');
  private targetFill = document.createElement('div');
  private targetValue = document.createElement('span');
  private targetIntent = document.createElement('div');
  private targetNote = document.createElement('div');
  /** How a fight with it would go (`consider`). */
  private targetConsider = document.createElement('div');
  private targetSaid = '';
  private feedBtn!: HTMLButtonElement;
  private companionText = document.createElement('span');
  /** What is on you, for you and against you: rest, meals, spells, wounds, a load (`effects.ts`). */
  readonly effects: EffectRow;
  private windEl: HTMLDivElement;
  /** The arrow the last track left, while it is fresh (`tracking.ts`). */
  private trailEl: HTMLDivElement;
  private trailArrow: HTMLSpanElement;
  private trailText: HTMLSpanElement;
  private storeyEl: HTMLDivElement;
  private storeyLabel: HTMLButtonElement;
  private storeyUp: HTMLButtonElement;
  private storeyDown: HTMLButtonElement;
  private cutBtn: HTMLButtonElement;
  private beltEl: HTMLDivElement;
  private loopEls: HTMLButtonElement[] = [];
  private stopBtn: HTMLButtonElement;
  /** The first-steps card's "Put it away", whose tooltip names the journal's key. */
  private hushBtn: HTMLButtonElement | null = null;
  private beltDue = 0;
  private foodEl: HTMLDivElement;
  private foodBars = new Map<string, HTMLDivElement>();
  private numbersTaken: () => boolean;

  constructor(
    root: HTMLElement,
    private readonly game: Game,
    cb: HudCallbacks,
  ) {
    const status = document.createElement('div');
    status.className = 'hud-status';
    this.statusEl = status;
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'hud-name';
    status.append(this.nameEl);
    for (const [id, label, cls] of [
      ['health', 'Health', 'bar-health'],
      ['stamina', 'Stamina', 'bar-stamina'],
      ['hunger', 'Food', 'bar-hunger'],
      ['thirst', 'Water', 'bar-thirst'],
    ]) {
      const row = document.createElement('div');
      row.className = 'hud-bar-row';
      const name = document.createElement('span');
      name.className = 'hud-bar-label';
      name.textContent = label;
      const track = document.createElement('div');
      track.className = 'hud-bar';
      const fill = document.createElement('div');
      fill.className = `hud-bar-fill ${cls}`;
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'hud-bar-value';
      row.append(name, track, value);
      status.append(row);
      this.bars[id] = { fill, value };
    }
    /*
     * What is actually in you: four thin bars under the food bar. Eating well
     * holds hunger and thirst off; eating well in all four teaches you more,
     * and that reads off the shortest of them, so the short one is the one to
     * look at. Each is named in full over its bar.
     */
    this.foodEl = document.createElement('div');
    this.foodEl.className = 'hud-food';
    for (const k of NUTRIENTS) {
      const cell = document.createElement('div');
      cell.className = 'hud-food-cell';
      const label = document.createElement('span');
      label.className = 'hud-food-label';
      label.textContent = NUTRIENT_NAMES[k];
      const track = document.createElement('div');
      track.className = 'hud-food-track';
      const fill = document.createElement('div');
      fill.className = `hud-food-fill food-${k}`;
      track.append(fill);
      cell.append(label, track);
      cell.title = `${NUTRIENT_NAMES[k]} — ${NUTRIENT_NOTES[k]}`;
      this.foodBars.set(k, fill);
      this.foodEl.append(cell);
    }
    status.append(this.foodEl);
    /*
     * The two things the bars ask of you, on a row of their own under them:
     * the way you stand in a fight (a click changes it, as the key does) and
     * eating. Beside their bars they cut those two bars short, and four bars
     * of four lengths cannot be read against each other.
     */
    const acts = document.createElement('div');
    acts.className = 'hud-acts';
    this.stanceBtn = document.createElement('button');
    this.stanceBtn.type = 'button';
    this.stanceBtn.className = 'hud-mini hud-stance';
    this.stanceBtn.addEventListener('click', () => this.game.cycleStance());
    this.eatBtn = document.createElement('button');
    this.eatBtn.type = 'button';
    this.eatBtn.className = 'hud-mini';
    this.eatBtn.textContent = 'Eat';
    this.eatBtn.addEventListener('click', () => this.eatBest());
    acts.append(this.stanceBtn, this.eatBtn);
    status.append(acts);
    const footer = document.createElement('div');
    footer.className = 'hud-footer';
    this.posEl = document.createElement('div');
    this.posEl.className = 'hud-pos';
    this.compass = document.createElement('span');
    this.compass.className = 'hud-compass';
    this.compass.title = 'North';
    this.compass.innerHTML =
      '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><polygon points="10,1 14,15 10,11.5 6,15" style="fill: var(--ui-accent)"/><polygon points="10,11.5 14,15 10,19 6,15" style="fill: var(--ui-border)"/></svg><b>N</b>';
    footer.append(this.posEl, this.compass);
    status.append(footer);
    /*
     * Everything on you, a mark each, under the clock: rest, a meal's knack,
     * favour and Calm, a spell, a light, a worn enchantment and a settlement's
     * baubles on the left; wounds, blood, venom, hunger, a load, tired arms
     * and the dark on the right. It took over the lines that said rest, a
     * meal, favour, a light and being overloaded, and the list of wounds,
     * so none of them is said twice.
     */
    this.effects = new EffectRow(game, cb.tooltip ?? null);
    status.append(this.effects.el);
    // The wind, when you are in something that cares about it.
    this.windEl = document.createElement('div');
    this.windEl.className = 'hud-companion hud-wind';
    this.windEl.hidden = true;
    status.append(this.windEl);
    // The way the last track read, for `TRACK_SHOW` seconds after it (`tracking.ts`).
    this.trailEl = document.createElement('div');
    this.trailEl.className = 'hud-companion hud-wind hud-trail';
    this.trailEl.hidden = true;
    this.trailArrow = document.createElement('span');
    this.trailArrow.className = 'wind-arrow trail-arrow';
    this.trailArrow.textContent = '\u2191';
    this.trailText = document.createElement('span');
    this.trailEl.append(this.trailArrow, this.trailText);
    status.append(this.trailEl);
    this.gearEl = document.createElement('div');
    this.gearEl.className = 'hud-companion hud-gear';
    this.gearEl.hidden = true;
    status.append(this.gearEl);
    this.companionEl = document.createElement('div');
    this.companionEl.className = 'hud-companion';
    this.companionEl.hidden = true;
    this.feedBtn = document.createElement('button');
    this.feedBtn.type = 'button';
    this.feedBtn.className = 'hud-mini';
    this.feedBtn.textContent = 'Feed';
    this.feedBtn.addEventListener('click', () => this.feedCompanion());
    this.companionEl.append(this.feedBtn);
    status.append(this.companionEl);
    root.append(status);
    /*
     * On a phone the status panel is the bars at the foot of the screen, and a
     * tap on it opens the rest of it over the strip; another tap, or a press on
     * the island, folds it again (`#ui.phone .hud-status` in src/style.css).
     */
    status.addEventListener('click', (e) => {
      if (!root.classList.contains('phone') || (e.target as Element).closest('button, input, select, a')) return;
      status.classList.toggle('hud-open');
    });
    root.ownerDocument.addEventListener('pointerdown', (e) => {
      if (status.classList.contains('hud-open') && !status.contains(e.target as Node)) status.classList.remove('hud-open');
    }, { capture: true });

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    this.toolbarEl = toolbar;
    // The buttons, in a row of their own: no box anywhere but a phone, where it scrolls sideways inside the toolbar's frame.
    const row = document.createElement('div');
    row.className = 'tb-row';
    toolbar.append(row);
    /*
     * One button for all thirteen windows.
     *
     * Anchored under itself rather than at the pointer, because the point of
     * this is a finger: the list wants to open where the thumb already is and
     * stay there, not follow a cursor that a phone does not have. Handed
     * over as a point on the screen, which the menu measures into the
     * interface's own pixels itself.
     */
    const windows = document.createElement('button');
    windows.type = 'button';
    windows.className = 'tb-btn tb-windows';
    windows.textContent = 'UI Menu';
    windows.title = 'All windows';
    windows.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = windows.getBoundingClientRect();
      cb.windows(r.left, r.bottom + 2);
    });
    row.append(windows);
    for (const b of BUTTONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tb-btn';
      btn.addEventListener('click', () => b.action(cb));
      if (b.id === 'grid') this.gridBtn = btn;
      if (b.bind) this.keyed.push({ btn, label: b.label, bind: b.bind });
      else btn.textContent = b.label;
      row.append(btn);
    }

    this.binds = cb.keys;
    this.drawKeys();
    root.append(toolbar);

    // The bottom-right corner: the Update button, when there is a later deploy, beside the version and frame rate.
    const corner = document.createElement('div');
    corner.className = 'hud-corner';
    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'hud-fps';
    corner.append(updateButton(), this.fpsEl);
    root.append(corner);

    this.actionEl = document.createElement('div');
    this.actionEl.className = 'action-bar';
    this.actionEl.hidden = true;
    this.actionLabel = document.createElement('div');
    this.actionLabel.className = 'action-label';
    const track = document.createElement('div');
    track.className = 'action-track';
    this.actionFill = document.createElement('div');
    this.actionFill.className = 'action-fill';
    track.append(this.actionFill);
    this.queueEl = document.createElement('div');
    this.queueEl.className = 'action-queue';
    this.queueEl.hidden = true;
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'action-hint';
    this.stopBtn = document.createElement('button');
    this.stopBtn.type = 'button';
    this.stopBtn.className = 'tb-btn tb-small action-stop';
    this.stopBtn.textContent = 'Stop';
    this.stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.cancelAction();
    });
    /*
     * Taking the work back up after a walk.
     *
     * Walking used to throw the whole list away; it holds it now, and this is
     * how it is taken up again. Deliberately a button rather than something
     * that happens by itself: jobs that started themselves the moment your
     * feet stopped would walk you straight back across the yard you had just
     * crossed on purpose.
     */
    this.goBtn = document.createElement('button');
    this.goBtn.type = 'button';
    this.goBtn.className = 'tb-btn tb-small action-stop';
    this.goBtn.textContent = 'Resume';
    this.goBtn.hidden = true;
    this.goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.resumeQueue();
    });
    this.actionEl.append(this.actionLabel, this.goBtn, this.stopBtn, track, this.queueEl, this.hintEl);
    this.stackEl.className = 'hud-stack';
    root.append(this.stackEl);

    // The target panel, top and middle, for what you are fighting or have marked; over the action bar on a phone (`placeTarget`).
    this.targetEl.className = 'hud-target';
    this.targetEl.hidden = true;
    this.targetName.className = 'hud-target-name';
    const targetTrack = document.createElement('div');
    targetTrack.className = 'hud-bar hud-target-bar';
    this.targetFill.className = 'hud-bar-fill bar-health';
    targetTrack.append(this.targetFill);
    this.targetValue.className = 'hud-bar-value';
    const targetRow = document.createElement('div');
    targetRow.className = 'hud-target-row';
    targetRow.append(targetTrack, this.targetValue);
    this.targetIntent.className = 'hud-target-intent';
    this.targetNote.className = 'hud-target-note';
    this.targetConsider.className = 'hud-target-consider';
    this.targetEl.append(this.targetName, targetRow, this.targetIntent, this.targetConsider, this.targetNote);

    /*
     * What to do next, for somebody who came ashore ninety seconds ago.
     *
     * There is no tutorial on this island and never has been. The journal is
     * eighty-five goals in eleven chapters, all on screen at once, which is a
     * fine list and a poor answer to the only question a new arrival has,
     * which is "what now": a list says everything at the same volume and
     * leaves the reading to you.
     *
     * So the first chapter is read out, one goal at a time, in as many words
     * as it takes — and then it stands down for good, because by the time the
     * stake is in the ground the question has changed to "what else" and the
     * journal is the right answer to that one. It can be put away sooner, and
     * once put away it stays away.
     */
    this.guideEl = document.createElement('div');
    this.guideEl.className = 'guide';
    this.guideEl.hidden = true;
    this.guideTitle = document.createElement('div');
    this.guideTitle.className = 'steps-title';
    this.guideBody = document.createElement('div');
    this.guideBody.className = 'steps-body';
    const guideBar = document.createElement('div');
    guideBar.className = 'steps-bar';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tb-btn tb-small';
    more.textContent = 'All goals';
    more.title = 'Open the journal goals';
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openJournal?.();
    });
    const hush = document.createElement('button');
    hush.type = 'button';
    hush.className = 'tb-btn tb-small';
    hush.textContent = 'Hide';
    this.hushBtn = hush;
    hush.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.settings.guide = false;
      this.guideEl.hidden = true;
    });
    guideBar.append(more, hush);
    this.guideEl.append(this.guideTitle, this.guideBody, guideBar);
    this.stackEl.append(this.targetEl, this.guideEl, this.actionEl);
    this.drawKeys();

    /*
     * The belt: the jobs you do most, hung on a worn toolbelt's loops and
     * pressed with the number keys. No belt, no loops.
     */
    this.beltEl = document.createElement('div');
    this.beltEl.className = 'belt-bar';
    this.beltEl.hidden = true;
    for (let i = 0; i < BELT_MAX; i += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'belt-loop';
      b.dataset.loop = String(i);
      const key = document.createElement('span');
      key.className = 'belt-key';
      key.textContent = String((i + 1) % 10);
      const what = document.createElement('span');
      what.className = 'belt-what';
      b.append(key, what);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.useLoop(i);
      });
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.clearLoop(i);
        this.drawBelt();
      });
      this.loopEls.push(b);
      this.beltEl.append(b);
    }
    root.append(this.beltEl);
    this.numbersTaken = cb.numbersTaken;
    this.game.events.on('inventory', () => this.drawBelt());
    this.drawBelt();

    /*
     * The storey control: which floor of a building you are looking at, and
     * whether the walls between you and it are taken away.
     */
    this.storeyEl = document.createElement('div');
    this.storeyEl.className = 'storey';
    this.storeyEl.hidden = true;
    const mk = (cls: string, text: string, title: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };
    this.storeyUp = mk('tb-btn storey-btn', '▲', 'Storey up (Page Up)', () => this.stepStorey(1));
    this.storeyLabel = mk('storey-label', 'Auto', 'Click: follow your storey', () => {
      this.game.settings.viewLevel = null;
    });
    this.storeyDown = mk('tb-btn storey-btn', '▼', 'Storey down (Page Down)', () => this.stepStorey(-1));
    this.cutBtn = mk('tb-btn storey-cut', '◪', 'Cut away facing walls (X)', () => {
      this.game.settings.cutaway = !this.game.settings.cutaway;
    });
    this.storeyEl.append(this.storeyUp, this.storeyLabel, this.storeyDown, this.cutBtn);
    root.append(this.storeyEl);
    for (const el of [status, toolbar, this.stackEl, this.beltEl, this.storeyEl]) keepKeys(el);
  }

  /**
   * Redraw the belt. Only the loops the worn belt actually has are shown, and
   * a loop greys out when what hangs on it cannot be done just now.
   */
  drawBelt(): void {
    const loops = this.game.beltLoops();
    this.beltEl.hidden = loops === 0;
    // The selection window takes the number keys while it is looking at
    // something, so the belt says so rather than leaving you to find out.
    const taken = this.numbersTaken();
    this.beltEl.classList.toggle('belt-yielded', taken);
    this.beltEl.title = taken ? 'Number keys go to the Tile window while a tile is selected. Close it or clear the selection to use the belt.' : '';
    for (let i = 0; i < BELT_MAX; i += 1) {
      const el = this.loopEls[i];
      el.hidden = i >= loops;
      if (i >= loops) continue;
      const what = el.querySelector('.belt-what') as HTMLSpanElement;
      const aim = this.game.aimLoop(i, null);
      if (!aim) {
        const pin = this.game.player.belt[i];
        what.textContent = pin ? pinLabel(pin, undefined) : 'empty';
        el.classList.toggle('belt-empty', !pin);
        el.classList.remove('belt-barred');
        el.title = pin ? 'Right-click: remove from belt.' : `Loop ${i + 1} empty. Hang an action here from a menu.`;
        continue;
      }
      const label = pinLabel(aim.pin, aim.def);
      what.textContent = label;
      el.classList.remove('belt-empty');
      el.classList.toggle('belt-barred', !!aim.reason);
      el.title = aim.reason ? `${label} — ${aim.reason}` : `${label}. Key ${(i + 1) % 10}; right-click: remove.`;
    }
  }

  /**
   * What you are fighting, or else what you have marked: its health, what it
   * is about this moment, and what its hide makes of the blow in your hand.
   * Gone once it is dead, tame, or twice `TARGET_RANGE` off.
   */
  private drawTarget(): void {
    const g = this.game;
    const id = g.fightTarget ?? g.marked;
    const c = id !== null ? g.creatures.get(id) : undefined;
    const p = g.player;
    const d = c ? Math.hypot(c.x - p.x, c.y - p.y) : Infinity;
    if (!c || c.health <= 0 || c.mode !== 'wild' || d > TARGET_RANGE * 2) {
      this.targetEl.hidden = true;
      return;
    }
    // Placed as it comes up, and looked over once a second after, since the bars it keeps clear of can be dragged.
    if (this.targetEl.hidden || --this.targetDue <= 0) {
      this.targetEl.hidden = false;
      this.targetDue = 10;
      this.placeTarget();
    }
    const def = g.creatures.species(c);
    const top = maxHealth(c, def);
    this.targetFill.style.width = `${Math.max(0, Math.min(1, c.health / top)) * 100}%`;
    this.targetValue.textContent = `${Math.ceil(c.health)}/${top}`;
    const brawl = c.brawl !== null ? g.creatures.get(c.brawl) : undefined;
    const intent = c.windup > 0 ? 'Heavy blow coming: step out of reach'
      : brawl ? `Fighting ${brawl.name}`
      : c.enemy === PLAYER_ATTACKER ? (d <= HUNT_REACH ? 'Attacking you' : 'Hunting you')
        : c.state === 'flee' ? 'Fleeing'
          : def.hunter || def.monster ? `Aggressive within ${def.notice ?? HUNT_SIGHT} tiles`
            : 'Not hostile';
    // And what is on it: a bleed, a burn, a stun (`enchanting.ts`).
    const bleeding = `${(c.burnUntil ?? 0) > g.time ? ', burning' : c.bleedUntil > g.time ? ', bleeding' : ''}${(c.stunUntil ?? 0) > g.time ? ', stunned' : ''}${(c.slowUntil ?? 0) > g.time ? ', slowed' : ''}`;
    const blow = blowOf(swungWith(g).def);
    const yours = hideTakes(def.hide, blow);
    const note = [
      def.hide ? `${HIDE_NAMES[def.hide]}: ${hideSays(def.hide)}.` : 'Hide: none.',
      yours !== 1 ? `Your ${blowWords(blow)}: damage ${yours > 1 ? '+' : '−'}${percent(Math.abs(yours - 1))}.` : '',
      def.heavy ? `Heavy blow every ${HEAVY_EVERY} blows.` : '',
      def.throws ? `Throws: range ${THROW_REACH} tiles, ${percent(THROW_HIT)} of a blow; backs off inside ${KEEP_OFF - BACK_SLACK} tiles.` : '',
      def.pack ? (c.packLead === c.id ? 'Pack leader: kill it and the pack flees.' : `Pack: joins within ${PACK_CALL} tiles.`) : '',
      def.hunter ? `Flees below ${percent(turnsAt(def))} health${def.coward ? `, or ${percent(COWARD_DRAG)} once one of its kind has fled` : ''}.` : '',
    ].filter(Boolean).join(' ');
    // How a fight with it would go (`consider`), coloured by which way it leans.
    const k = consider(g, c);
    const weigh = `Blows to kill: yours ~${k.mine}, its ~${k.its}.`;
    const said = `${def.name}|${intent}${bleeding}|${note}|${c.windup > 0}|${weigh}|${k.rating}`;
    if (said === this.targetSaid) return;
    this.targetSaid = said;
    this.targetConsider.textContent = weigh;
    this.targetConsider.dataset.rating = k.rating;
    this.targetName.textContent = def.name;
    this.targetIntent.textContent = `${intent}${bleeding}`;
    this.targetIntent.classList.toggle('hud-target-warn', c.windup > 0);
    this.targetNote.textContent = note;
  }

  /** Updates until the target panel is placed again. */
  private targetDue = 0;

  /**
   * Put the target panel top and middle, under the status panel or the
   * toolbar where either is in the way: the toolbar starts there. On a phone
   * it sits in the stack over the action bar instead, where the CSS puts it.
   */
  private placeTarget(): void {
    const t = this.targetEl;
    if (t.parentElement?.parentElement?.classList.contains('narrow')) {
      t.style.top = '';
      return;
    }
    let top = TARGET_TOP;
    // Measured against the interface, which the panel is centred in: a fixed box has no offset parent to measure from.
    const w = t.offsetWidth, left = ((this.statusEl.parentElement?.clientWidth ?? 0) - w) / 2, right = left + w, h = t.offsetHeight;
    const bars = [this.statusEl, this.toolbarEl].filter((b) => b.offsetLeft < right && b.offsetLeft + b.offsetWidth > left).sort((a, b) => a.offsetTop - b.offsetTop);
    for (const b of bars) if (b.offsetTop < top + h && b.offsetTop + b.offsetHeight > top) top = b.offsetTop + b.offsetHeight + TARGET_GAP;
    t.style.top = `${top}px`;
  }

  /**
   * Put the current key on every button that names one.
   *
   * Called once when the toolbar is built and again whenever a binding changes,
   * so a button cannot go on claiming a key that now does something else. A
   * button whose thing has been left unbound simply stops claiming anything.
   */
  drawKeys(): void {
    for (const k of this.keyed) {
      const codes = this.binds.codes(k.bind);
      k.btn.innerHTML = codes.length ? `${esc(k.label)} <kbd>${esc(keyName(codes[0]))}</kbd>` : esc(k.label);
    }
    const stop = this.keyWord('stop');
    const journal = this.keyWord('win_journal');
    if (this.stopBtn) this.stopBtn.title = `Stop and clear the queue${stop ? ` (${stop})` : ''}`;
    if (this.hushBtn) this.hushBtn.title = `Hide. All goals in the journal${journal ? ` (${journal})` : ''}.`;
  }

  /** The key a binding answers to just now, by name, or null when it is left unbound. */
  private keyWord(bind: string): string | null {
    const codes = this.binds.codes(bind);
    return codes.length ? keyName(codes[0]) : null;
  }

  /** Move the view a storey up or down, starting from where the player stands: down to a cellar, where there is one. */
  stepStorey(step: number): void {
    const s = this.game.settings;
    const from = s.viewLevel ?? this.game.player.level;
    s.viewLevel = Math.max(this.lowestStorey(), Math.min(TOP_LEVELS - 1, from + step));
  }

  /** The lowest storey there is to look at: a cellar's, once anybody has dug one, and otherwise the ground floor. */
  private lowestStorey(): number {
    return this.game.buildings.cellars.size ? CELLAR_LEVEL : 0;
  }

  toggleCutaway(): void {
    this.game.settings.cutaway = !this.game.settings.cutaway;
  }

  /** Eat the best thing you are carrying, without hunting for it in the pack. */
  private eatBest(): void {
    const food = this.game.bestFood();
    if (!food) {
      this.game.logMsg('No food.', 'error');
      return;
    }
    const def = ACTION_BY_ID.get('eat');
    if (def) this.game.requestAction(def, { kind: 'item', uid: food.uid });
  }

  /** Feed your companion the poorest thing it will take, and keep the rest. */
  private feedCompanion(): void {
    const c = this.game.creatures.active();
    if (!c) return;
    const food = this.game.worstFoodFor(c);
    if (!food) {
      this.game.logMsg(`No food for ${c.name}, no bucket of whey.`, 'error');
      return;
    }
    const def = ACTION_BY_ID.get('feed');
    if (def) this.game.requestAction(def, { kind: 'creature', id: c.id, itemUid: food.uid });
  }

  private refreshStorey(): void {
    const s = this.game.settings;
    // Only worth showing once there is something built to look into.
    this.storeyEl.hidden = this.game.buildings.list.size === 0 && s.viewLevel === null;
    if (this.storeyEl.hidden) return;
    const level = s.viewLevel;
    this.storeyLabel.textContent = level === null ? 'Auto' : level < 0 ? 'Cellar' : ordinal(level + 1);
    this.storeyLabel.classList.toggle('pinned', level !== null);
    this.storeyUp.disabled = level !== null && level >= TOP_LEVELS - 1;
    this.storeyDown.disabled = level !== null && level <= this.lowestStorey();
    this.cutBtn.classList.toggle('active', s.cutaway);
  }

  /** A node's tooltip, written only when it has changed. */
  private readonly tips = new WeakMap<HTMLElement, string>();
  private tip(el: HTMLElement, text: string): void {
    if (this.tips.get(el) === text) return;
    this.tips.set(el, text);
    el.title = text;
  }

  /** Write to a node only when what it would say has changed. */
  private say(el: HTMLElement, text: string): void {
    if (this.said.get(el) === text) return;
    this.said.set(el, text);
    el.textContent = text;
  }

  /**
   * Everything along the top and down the side, a few times a second.
   *
   * This used to run on every frame: a dozen `textContent` writes, a handful
   * of template strings, `Object.entries` over the bars, and the whole wound
   * list torn down and built again out of fresh elements — sixty times a
   * second, for figures that change a few times a minute. Every one of those
   * writes can make the browser lay the page out again, and the hud sits over
   * the canvas, so it was doing it in the middle of the frame.
   *
   * Every other panel in the game has gone through `Repaint` since it was
   * written. This one had been missed. Ten times a second is quicker than
   * anybody reads, and nothing is written at all unless it differs from what
   * is already on the screen.
   */
  update(renderer: Renderer, fps: number): void {
    const now = performance.now();
    if (now - this.lastAt < HUD_EVERY) return;
    this.lastAt = now;
    this.refreshStorey();
    this.refreshGuide();
    const p = this.game.player;
    this.say(this.nameEl, p.name);
    for (const [id, bar] of Object.entries(this.bars)) {
      const v = p.stats[id as keyof typeof p.stats];
      const pct = `${Math.round(v * 100)}%`;
      if (this.said.get(bar.value) === pct) continue;
      this.said.set(bar.value, pct);
      bar.fill.style.width = pct;
      bar.value.textContent = pct;
    }
    // How big the stamina bar is: body stamina grows it (`staminaBar`).
    const size = `Stamina bar ×${this.game.staminaBar().toFixed(2)} of level ${CHAR_START}`;
    const row = this.bars.stamina?.value.parentElement;
    if (row && row.title !== size) row.title = size;
    const h = this.game.world.heightAt(p.x, p.y);
    const standing = this.game.deedOfMineAt(p.tileX, p.tileY);
    const deed = standing ? `  ·  ${standing.name}` : '';
    const title = this.game.titleName();
    this.say(this.posEl, `${p.tileX}, ${p.tileY}  ·  h ${metres(h)} m  ·  ${this.game.clock()}  ·  ${seasonLine(this.game.wallNow())}${p.swimming ? '  ·  swimming' : ''}${deed}${title ? `  ·  ${title}` : ''}`);
    // What is on you: a mark each, written only where a mark has changed.
    this.effects.update();
    // The wind, which only matters when there is a sail over you.
    const boat = this.game.afloat();
    const sailing = boat && FURNITURE_BY_ID.get(boat.kind)?.boat?.sail;
    this.windEl.hidden = !sailing;
    if (sailing) {
      const w = this.game.wind();
      const point = sailWord(this.game.heading(), w);
      this.windEl.replaceChildren();
      const arrow = document.createElement('span');
      arrow.className = 'wind-arrow';
      // The arrow flies with the wind, and the compass rose is already turned.
      arrow.style.transform = `rotate(${(w.dir * 180) / Math.PI + 90 + renderer.camera.northAngle()}deg)`;
      arrow.textContent = '\u2191';
      const text = document.createElement('span');
      text.className = point === 'in irons' ? 'wind-irons' : '';
      text.textContent = `${windWord(w.force)} out of the ${windFrom(w)} · ${point}`;
      this.windEl.append(arrow, text);
      this.windEl.title = point === 'in irons' ? 'In irons: no sailing speed. Turn off the wind.' : 'Fastest across the wind; none head-on.';
    }
    /*
     * The last track's arrow: the way it read, from where you stood when it
     * was read, turned with the view as the compass is and not with you or
     * with what was tracked. Gone `TRACK_SHOW` seconds after the go.
     */
    const trail = this.game.trail;
    const left = trail ? TRACK_SHOW - (this.game.time - trail.at) : 0;
    this.trailEl.hidden = !trail || left <= 0;
    if (trail && left > 0) {
      this.trailArrow.style.transform = `rotate(${(trail.bearing + renderer.camera.northAngle()).toFixed(1)}deg)`;
      this.say(this.trailText, `${trail.name} · ${trail.dist}`);
      this.trailEl.title = `Last track from (${Math.floor(trail.x)}, ${Math.floor(trail.y)}): bearing ${trail.bearing}\u00b0. Expires in ${Math.ceil(left)} s.`;
    }
    const mobs = this.game.creatures.ticked;
    const watched = this.game.settings.fog ? ` · ${mobs.thought}/${mobs.near + mobs.far + mobs.asleep} mobs` : '';
    // And, asked for, a frame's length beside the time it spent drawing: much longer than its drawing is a frame waiting on the graphics chip.
    const t = renderer.timings;
    const timed = !this.game.settings.timings ? ''
      : (t.line && fps > 0 ? `\nframe ${(1000 / fps).toFixed(1)} ms · ${t.line}` : '') + (t.measuring ?? t.measured ? `\n${t.measuring ?? t.measured}` : '');
    this.say(this.fpsEl, `${VERSION} · ${fps} fps · ${renderer.tilesDrawn} tiles${watched} · ${renderer.camera.zoom.toFixed(2)}×${timed}`);
    const svg = this.compass.firstElementChild as HTMLElement | null;
    if (svg) svg.style.transform = `rotate(${renderer.camera.northAngle().toFixed(1)}deg)`;
    // What is in your hands and how much armour is on you.
    const held = this.game.worn('weapon');
    const shield = this.game.worn('offhand');
    const pieces = (['head', 'chest', 'arms', 'legs', 'feet'] as const).filter((sl) => this.game.worn(sl)).length;
    if (held || shield || pieces) {
      const bits: string[] = [];
      if (held) bits.push(itemName(held));
      if (shield) bits.push(itemName(shield));
      if (pieces) bits.push(`${pieces}/5 armour`);
      this.gearEl.textContent = bits.join(' · ');
      this.gearEl.hidden = false;
    } else this.gearEl.hidden = true;
    // The four nutrients, and what the table is worth right now.
    const n = this.game.player.nutrition;
    for (const k of NUTRIENTS) {
      const fill = this.foodBars.get(k);
      if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, n[k])) * 100)}%`;
    }
    // What a full table is worth to you: a fifth, or more for a Cook's Balanced Diet.
    const best = this.game.tableBest();
    const worth = Math.round((tableMul(n, best) - 1) * 100);
    this.foodEl.title = `${fedWord(n)} — skill gain +${worth}%. Set by the lowest of the four (${Math.round(balance(n) * 100)}%); max +${percent(best)}.`;
    this.foodEl.classList.toggle('hud-food-full', balance(n) >= 0.999);

    const companion = this.game.creatures.active();
    if (companion) {
      const hunger = companion.hunger < 0.3 ? 'hungry' : companion.hunger < 0.6 ? 'peckish' : 'fed';
      this.companionText.textContent = `${companion.name} · ♥ ${Math.ceil(companion.health)} · ${hunger} · ${companion.stance} `;
      if (!this.companionText.parentElement) this.companionEl.prepend(this.companionText);
      const feed = this.game.worstFoodFor(companion);
      this.feedBtn.disabled = !feed;
      this.tip(this.feedBtn, feed
        ? `Feed ${companion.name} ${itemName(feed).toLowerCase()}: hunger +${percent(feedFill(feed.id))}. `
          + 'Picks the least filling, then lowest QL, food.'
        : `No food for ${companion.name}, no bucket of whey`);
      this.companionEl.hidden = false;
    } else this.companionEl.hidden = true;
    const food = this.game.bestFood();
    this.eatBtn.disabled = !food;
    this.tip(this.eatBtn, food ? `Eat ${itemName(food).toLowerCase()} (best food carried)` : 'No food');
    this.drawTarget();
    const stance = this.game.settings.fightStance;
    if (this.stanceBtn.dataset.stance !== stance) {
      this.stanceBtn.dataset.stance = stance;
      this.stanceBtn.textContent = `${FIGHT_STANCE_NAMES[stance]} stance`;
      this.stanceBtn.title = `${FIGHT_STANCE_NAMES[stance]} stance: ${stanceSays(stance)} Click to change.`;
    }
    if (this.gridBtn) this.gridBtn.classList.toggle('active', this.game.settings.grid);

    // The belt is cheap to draw but not free, so it is looked over four times a second.
    this.beltDue -= 1;
    if (this.beltDue <= 0) {
      this.beltDue = 15;
      this.drawBelt();
    }

    const a = this.game.action;
    const waiting = this.game.queue;
    /*
     * Nothing in hand, but something waiting.
     *
     * The bar used to go away entirely here and leave `queueEl` showing
     * whatever it last said, which was a stale "Then: …" line under nothing
     * at all. It has a second job now: when a walk has put the work down, the
     * bar stays up to say what is waiting and offer to take it up again,
     * because a list of jobs that is kept and never mentioned is a list that
     * has been lost as far as anybody can tell.
     */
    if (!a) {
      if (!waiting.length) {
        this.actionEl.hidden = true;
        this.queueEl.hidden = true;
        this.goBtn.hidden = true;
        return;
      }
      this.actionEl.hidden = false;
      this.goBtn.hidden = false;
      this.actionLabel.textContent = `Actions paused: ${waiting.length}`;
      this.actionFill.style.width = '0%';
      this.queueEl.hidden = false;
      this.queueEl.textContent = `Waiting: ${this.queueWords(waiting)}`;
      const stop = this.keyWord('stop');
      const on = this.keyWord('carry_on');
      this.say(this.hintEl, `Resume${on ? ` (${on})` : ''}${stop ? ` · clear (${stop})` : ''}`);
      return;
    }
    this.actionEl.hidden = false;
    this.goBtn.hidden = true;
    const stop = this.keyWord('stop');
    this.say(this.hintEl, `${stop ? `${stop} to stop · ` : ''}moving puts it down`);
    // A counted job says how far through the count it is: "3 of 10". Coming
    // back to an island mid-job, the island knows what is left and nobody
    // knows what was asked for, so it says that instead.
    // Both numbers are the island's and belong to the same job, so the sum is
    // sound; it is still clamped, because a bar that reads "-8 of 1" is worse
    // than one that reads nothing and there is no telling what an island a
    // version behind will say.
    const at = a.goes !== undefined && a.left !== undefined ? a.goes - a.left + 1 : 0;
    const count = a.goes !== undefined && a.left !== undefined && at >= 1 && at <= a.goes
      ? ` · ${at} of ${a.goes}`
      : a.left !== undefined && a.left > 1 ? ` · ${a.left} to go` : '';
    if (a.state === 'walking') {
      this.actionLabel.textContent = `Walking to: ${a.def.label.toLowerCase()}…${count}`;
      this.actionFill.style.width = '0%';
    } else {
      const pct = Math.min(100, (a.elapsed / a.duration) * 100);
      this.actionLabel.textContent = `${a.def.doing?.(a.target, this.game) ?? a.def.label} · ${Math.max(0, a.duration - a.elapsed).toFixed(1)}s${count}`;
      this.actionFill.style.width = `${pct}%`;
    }
    // What is lined up behind it, and how much room is left in your head.
    if (waiting.length) {
      this.queueEl.hidden = false;
      this.queueEl.textContent = `Then: ${this.queueWords(waiting)} (${waiting.length + 1} of ${this.game.queueCapacity()} actions held)`;
    } else this.queueEl.hidden = true;
  }

  /**
   * The next thing to do, while there is still a first thing.
   *
   * Only rewritten when the goal changes, since this runs every frame and the
   * answer is the same from one to the next for minutes at a time.
   */
  private refreshGuide(): void {
    if (!this.game.settings.guide || ashore(this.game.ticked)) {
      if (!this.guideEl.hidden) this.guideEl.hidden = true;
      return;
    }
    const next = nextGoals(this.game.ticked, 1)[0];
    if (!next) {
      this.guideEl.hidden = true;
      return;
    }
    if (next.id === this.guideOn) return;
    this.guideOn = next.id;
    this.guideEl.hidden = false;
    const done = JOURNAL[0].goals.filter((g) => this.game.ticked.has(g.id)).length;
    this.guideTitle.textContent = `${next.text} \u00b7 ${done + 1} of ${JOURNAL[0].goals.length}`;
    this.guideBody.textContent = next.how ?? next.hint ?? '';
  }

  /**
   * What is lined up, in words. Each one says what it is *for* and not only
   * what it is: three flattens and one flatten ten times are a very different
   * afternoon.
   */
  private queueWords(queue: Game['queue']): string {
    return queue.map((q) => `${q.def.label.toLowerCase()}${(q.goes ?? 1) > 1 ? ` \u00d7${q.goes}` : ''}`).join(' \u2192 ');
  }
}
