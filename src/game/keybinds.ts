/**
 * What every key does, and how to say it should do something else.
 *
 * Until now the keys lived in one `switch` in `main.ts`, which was fine while
 * nobody wanted to change them and useless the moment somebody did. This is the
 * same list said once, as data: an id, what it is for, and the codes that reach
 * it. `main.ts` asks "what is this key for" instead of knowing, and the Settings
 * window writes to the same table it reads.
 *
 * Two things are deliberately not in here. The **number keys** are not a
 * binding, they are ten of a kind: 1–9 and 0 answer to whatever the selection
 * window or the toolbelt is offering, and a rebindable "action 7" would be a
 * different game. And **the mouse** is not in here either, because there is
 * nothing to choose: left click walks and right click asks, and a game with
 * only two buttons has no room for a preference.
 *
 * Codes are `KeyboardEvent.code` — physical keys, not letters — so a binding
 * made on one layout still lands under the same finger on another.
 */

import { SIDE_NAMES } from './building';
import { NODES_PER_TRADE, PERK_TIER_AT, PERKS_PER_TIER } from './classes';
import { FAITH_TIER_AT, PATRONS, SPELLS_PER_TIER } from './patrons';
import { TURNS } from '../render/view';
import { FALL_BACK, FIGHT_STANCE_NAMES, FIGHT_STANCES, FOLLOW_RANGE, stanceSays, TARGET_RANGE } from './fight';

/** What each kept arrangement of windows is called until it is renamed: what most people keep a screen for, and a spare. */
export const LAYOUT_NAMES = ['Crafting', 'Fighting', 'Building', 'Travelling'];

/** What a turn key turns by: the view one of its viewpoints, a piece being set down one of its sides. */
const VIEW_TURN = `1/${TURNS}`;
const PIECE_TURN = `1/${Object.keys(SIDE_NAMES).length}`;

/** What a key can be set to do. */
export interface BindDef {
  id: string;
  label: string;
  hint: string;
  group: string;
  /** Codes it answers to, best first. Two is the most any of them keeps. */
  keys: string[];
  /** Listed only for somebody the island says keeps it; nobody else has the window it opens. */
  keeper?: boolean;
}

export const BIND_GROUPS = ['Moving the view', 'Windows', 'Doing things'] as const;

/**
 * The defaults.
 *
 * WASD pushes the **view** rather than the body: walking is a click, and a
 * click is the only thing that walks. The arrows do the same as WASD so that a
 * hand on either side of the keyboard can shift the view.
 */
export const BINDS: BindDef[] = [
  { id: 'pan_up', label: 'Push the view up', hint: 'Pan the view up; stops camera follow.', group: 'Moving the view', keys: ['KeyW', 'ArrowUp'] },
  { id: 'pan_down', label: 'Push the view down', hint: 'Pan the view down.', group: 'Moving the view', keys: ['KeyS', 'ArrowDown'] },
  { id: 'pan_left', label: 'Push the view left', hint: 'Pan the view left.', group: 'Moving the view', keys: ['KeyA', 'ArrowLeft'] },
  { id: 'pan_right', label: 'Push the view right', hint: 'Pan the view right.', group: 'Moving the view', keys: ['KeyD', 'ArrowRight'] },
  { id: 'centre', label: 'Centre on yourself', hint: 'Centre the view on you; camera follows again.', group: 'Moving the view', keys: ['KeyC'] },
  { id: 'turn_left', label: 'Turn the view left', hint: `Rotate the view ${VIEW_TURN} turn; the compass shows north. While placing something: rotate it ${PIECE_TURN} turn.`, group: 'Moving the view', keys: ['KeyQ'] },
  { id: 'turn_right', label: 'Turn the view right', hint: 'Rotate the other way (view, or the piece being placed).', group: 'Moving the view', keys: ['KeyE'] },
  { id: 'zoom_in', label: 'Zoom in', hint: 'Same as scroll up.', group: 'Moving the view', keys: ['Equal', 'NumpadAdd'] },
  { id: 'zoom_out', label: 'Zoom out', hint: 'Same as scroll down.', group: 'Moving the view', keys: ['Minus', 'NumpadSubtract'] },
  { id: 'storey_up', label: 'Look at the storey above', hint: 'Pins it: other storeys hidden, clicks on its floor.', group: 'Moving the view', keys: ['PageUp'] },
  { id: 'storey_down', label: 'Look at the storey below', hint: 'Pins it: other storeys hidden, clicks on its floor.', group: 'Moving the view', keys: ['PageDown'] },
  { id: 'cutaway', label: 'Cut away the walls facing you', hint: 'Hide walls between you and a building interior.', group: 'Moving the view', keys: ['KeyX'] },
  { id: 'grid', label: 'Show the tile grid', hint: 'Outline every tile.', group: 'Moving the view', keys: ['KeyG'] },

  { id: 'win_inventory', label: 'Inventory', hint: 'Carried items.', group: 'Windows', keys: ['KeyI'] },
  { id: 'win_craft', label: 'Crafting', hint: 'Recipes you can make.', group: 'Windows', keys: ['KeyR'] },
  { id: 'win_tile', label: 'Tile', hint: 'Actions on the last thing clicked.', group: 'Windows', keys: ['KeyT'] },
  { id: 'win_skills', label: 'Skills', hint: 'Skill levels.', group: 'Windows', keys: ['KeyK'] },
  // Every letter is spoken for, and the comma is nobody's.
  { id: 'win_equipment', label: 'Equipment', hint: 'Worn items on a figure (drag on and off); every combat number and the skills behind them.', group: 'Windows', keys: ['BracketLeft'] },
  { id: 'win_health', label: 'Health', hint: 'Wounds on a figure, what each needs to dress, clean or salve (with buttons); effects on you; nutrition.', group: 'Windows', keys: ['Comma'] },
  { id: 'win_trades', label: 'Trades', hint: `Your craft and fighting class: each one's ${NODES_PER_TRADE} nodes or ${PERK_TIER_AT.length * PERKS_PER_TIER} perks, and its rite.`, group: 'Windows', keys: ['KeyF'] },
  { id: 'win_faith', label: 'Faith', hint: `Devotion and favour; ${PATRONS.length} patrons; your patron's spells, ${SPELLS_PER_TIER} per faith tier at ${FAITH_TIER_AT.length} faith tiers, pick one per faith tier. Spell bar: Shift + slot number.`, group: 'Windows', keys: [] },
  { id: 'win_tracker', label: 'Tracker', hint: 'Journal, Tracker tab: watched skills, a bar each.', group: 'Windows', keys: ['KeyV'] },
  { id: 'win_events', label: 'Event log', hint: 'Event log and chat box.', group: 'Windows', keys: ['KeyL'] },
  { id: 'win_map', label: 'Map', hint: 'Explored map.', group: 'Windows', keys: ['KeyM'] },
  { id: 'win_wildermon', label: 'Wildermon', hint: 'Your wildermon: loads and assignments.', group: 'Windows', keys: ['KeyP'] },
  // F3 is the browser's own Find in every one of them, and F4 is nobody's.
  { id: 'win_guide', label: 'Field guide', hint: 'Journal, Field guide tab: every creature kind; seen, tamed, bred; habitat and yields.', group: 'Windows', keys: ['F4'] },
  { id: 'win_deed', label: 'Settlement', hint: 'Settlement overview.', group: 'Windows', keys: ['KeyN'] },
  // U is the Stores': the two shared it, and a key does one thing, so the Market had none.
  { id: 'win_market', label: 'Market', hint: 'Stalls and buy orders, your orders, deals, stall sales, parcels in the post.', group: 'Windows', keys: ['BracketRight'] },
  { id: 'win_social', label: 'Social', hint: 'Requests, contacts and locations, letters.', group: 'Windows', keys: ['KeyY'] },
  // Every letter is spoken for, and no browser takes F2 for itself.
  { id: 'win_boards', label: 'Leaderboards', hint: 'Journal, Leaderboards tab: top skills, best-bred wildermon, biggest settlements.', group: 'Windows', keys: ['F2'] },
  { id: 'win_ledger', label: 'Ledger', hint: 'Journal, Ledger tab: everything you have made.', group: 'Windows', keys: [] },
  { id: 'win_shopping', label: 'Shopping list', hint: 'Crafting List targets and all inputs down to raw materials, against your pack and nearby stores.', group: 'Windows', keys: [] },
  { id: 'win_stores', label: 'Stores', hint: 'Contents of every crate and cupboard on your settlement.', group: 'Windows', keys: ['KeyU'] },
  { id: 'win_journal', label: 'Journal', hint: 'Goals; tick themselves off.', group: 'Windows', keys: ['KeyJ'] },
  // No key out of the box: it is for the few who keep an island, and every letter is spoken for.
  { id: 'win_keeper', label: 'Island keeper', hint: 'Open reports; everyone on the island: position, muted, barred; Move, Mute, Unmute, Kick, Unbar, Handled.', group: 'Windows', keys: [], keeper: true },
  { id: 'win_settings', label: 'Settings', hint: 'This window.', group: 'Windows', keys: ['KeyO'] },
  { id: 'win_help', label: 'Help', hint: 'Journal, Help tab.', group: 'Windows', keys: ['F1', 'KeyH'] },
  // No key out of the box: every letter is spoken for, and it opens by itself when there is something new.
  { id: 'win_news', label: "What's new", hint: "Journal, What's new tab: island changes, newest first; unread marked.", group: 'Windows', keys: [] },
  // Ctrl+K and ⌘K open it too, wherever they are not taken by something you are typing in.
  { id: 'palette', label: 'Find anything', hint: 'Search windows, recipes, settings, help, layouts and keys by name; opens the match. Also Ctrl+K.', group: 'Windows', keys: ['Slash'] },
  // F6 to F9: the letters are spoken for, and F1, F2 and F4 already open windows.
  ...LAYOUT_NAMES.map((name, i) => ({
    id: `layout_${i + 1}`,
    label: `Window layout ${i + 1} (${name} until renamed)`,
    hint: `Restore layout ${i + 1}: window positions, sizes, open or shut. Shift: save the current windows as layout ${i + 1}. Rename in Settings, Windows.`,
    group: 'Windows',
    keys: [`F${6 + i}`],
  })),

  { id: 'walk_home', label: 'Walk home', hint: 'Walk to your settlement totem or bed.', group: 'Doing things', keys: ['Home'] },
  /*
   * One key for all of them rather than one each. Two emotes is a pair of
   * keybindings; five is a keyboard nobody can remember, and the menu costs
   * one keypress more than a bind and never runs out of room.
   */
  { id: 'emotes', label: 'Emotes', hint: 'Emote menu.', group: 'Doing things', keys: ['KeyZ'] },
  { id: 'stop', label: 'Stop', hint: 'Cancel the current action and the action queue. Closes an open menu first.', group: 'Doing things', keys: ['Escape'] },
  // Full stop is Vim's repeat, and no letter was left.
  { id: 'repeat', label: 'Do it again', hint: 'Repeat the last action: same target, same count. Uses another stack of the same kind if the old one is gone.', group: 'Doing things', keys: ['Period'] },
  { id: 'carry_on', label: 'Carry on', hint: 'Resume actions put down by walking.', group: 'Doing things', keys: ['KeyB'] },
  { id: 'chat', label: 'Talk', hint: 'Focus the chat box (event log).', group: 'Doing things', keys: ['Enter'] },
  // Tab and Space are nobody else's, and a key a hand finds without looking is what a fight wants.
  { id: 'fight_mark', label: 'Mark the nearest foe', hint: `Target the nearest hostile wild creature within ${TARGET_RANGE} tiles; again for the next.`, group: 'Doing things', keys: ['Tab'] },
  { id: 'fight', label: 'Attack', hint: `Attack the target, last-clicked creature, or nearest foe (melee, or bow shot). Follows out of reach up to ${FOLLOW_RANGE} tiles.`, group: 'Doing things', keys: ['Space'] },
  { id: 'fight_stance', label: 'Change stance', hint: `${FIGHT_STANCES.map((s) => `${FIGHT_STANCE_NAMES[s]}: ${stanceSays(s)}`).join(' ')}`, group: 'Doing things', keys: ['Backquote'] },
  { id: 'pet_attack', label: 'Companion: attack my target', hint: 'Companion attacks your target, or else the nearest foe, regardless of stance.', group: 'Doing things', keys: ['Semicolon'] },
  { id: 'pet_back', label: 'Companion: fall back', hint: `Companion leaves its fight, returns to you, starts no fight for ${FALL_BACK} s.`, group: 'Doing things', keys: ['Quote'] },
];

export const BIND_BY_ID = new Map(BINDS.map((b) => [b.id, b]));
/** The key a thing answers to out of the box, for a line said before anybody could have changed it. */
export const defaultKey = (id: string): string => keyName(BIND_BY_ID.get(id)?.keys[0] ?? '');

/** The table in use on this page, once there is one (`Keybinds`). */
let live: Keybinds | null = null;
/** The key a thing answers to now: the first of its keys in the table in use, or out of the box before there is one; "unbound" for none. */
export const boundKey = (id: string): string => {
  if (!live) return defaultKey(id) || 'unbound';
  const code = live.codes(id)[0];
  return code ? keyName(code) : 'unbound';
};
/** The most keys any one thing answers to. */
export const MAX_KEYS = 2;

const STORAGE_KEY = 'wurm-iso-keys';

/**
 * How a key code reads on a key.
 *
 * `KeyboardEvent.code` is a physical position with a name like `Semicolon`,
 * which is exactly wrong to put in front of somebody. These are the ones worth
 * spelling out; anything else has its prefix taken off and is left alone.
 */
const NAMES: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Equal: '=', Minus: '−', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
  Comma: ',', Period: '.', Slash: '/',
  Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab',
  PageUp: 'Page Up', PageDown: 'Page Down', Home: 'Home', End: 'End',
  Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace',
  CapsLock: 'Caps Lock', ContextMenu: 'Menu',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×',
  NumpadDivide: 'Num ÷', NumpadDecimal: 'Num .', NumpadEnter: 'Num Enter',
};

export function keyName(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/**
 * Keys that are spoken for whatever anybody would rather they did.
 *
 * The digits are the selection window and the toolbelt, and taking one of them
 * for something else would leave a hole in a row of ten. The modifiers are not
 * keys anybody presses on their own.
 */
export function keyReserved(code: string): string | null {
  if (/^Digit[0-9]$/.test(code)) return 'Number keys are reserved for the selection window and toolbelt.';
  if (/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code)) return 'Modifier keys cannot be bound.';
  return null;
}

interface Saved {
  [id: string]: string[];
}

/**
 * The live table: what each thing answers to, and what each key reaches.
 *
 * Kept in `localStorage` rather than in the save, for the same reason the
 * window layout is: it is a fact about the person sitting here, not about the
 * island. Carrying it in a save would mean a keyboard changing under you when
 * you loaded somebody else's world.
 */
export class Keybinds {
  private keys = new Map<string, string[]>();
  private byCode = new Map<string, string>();
  /** Told whenever anything is rebound, so the help and the panel can redraw. */
  onChange?: () => void;

  constructor() {
    this.reset(false);
    this.load();
    live = this;
  }

  /** The codes one thing answers to, in the order they are shown. */
  codes(id: string): string[] {
    return this.keys.get(id) ?? [];
  }

  /** What this key does, or null. */
  actionFor(code: string): string | null {
    return this.byCode.get(code) ?? null;
  }

  /** Whether a key that is being held is one of the ones bound to this. */
  isHeld(id: string, down: (code: string) => boolean): boolean {
    for (const code of this.codes(id)) if (down(code)) return true;
    return false;
  }

  /** How the binding reads, for a table or a tooltip. */
  label(id: string): string {
    const codes = this.codes(id);
    return codes.length ? codes.map(keyName).join(' / ') : 'unbound';
  }

  /**
   * Put a code in one of a thing's slots.
   *
   * A key does one thing. Binding a key that is already spoken for takes it off
   * whatever had it, rather than leaving two things fighting over one press and
   * letting the order of a list decide which wins. What comes back says what
   * was displaced, so the panel can say so out loud.
   */
  bind(id: string, slot: number, code: string): { ok: boolean; why?: string; took?: string } {
    if (!BIND_BY_ID.has(id)) return { ok: false, why: 'There is no such thing to bind.' };
    const reserved = keyReserved(code);
    if (reserved) return { ok: false, why: reserved };
    const had = this.byCode.get(code);
    if (had === id && this.codes(id)[slot] === code) return { ok: true };
    if (had) this.setCodes(had, this.codes(had).filter((c) => c !== code));
    const mine = this.codes(id).slice();
    mine[slot] = code;
    this.setCodes(id, mine);
    this.save();
    this.onChange?.();
    return { ok: true, took: had && had !== id ? had : undefined };
  }

  /** Take a key off something, leaving the slot empty. */
  clear(id: string, slot: number): void {
    const mine = this.codes(id).slice();
    if (mine[slot] === undefined) return;
    mine.splice(slot, 1);
    this.setCodes(id, mine);
    this.save();
    this.onChange?.();
  }

  /**
   * One thing back to how it came out of the box, taking its keys off whatever
   * has them now. The way back to Escape, Backspace and Delete, which the Keys
   * tab cannot be pressed with while it listens.
   */
  restore(id: string): { took: string[] } {
    const def = BIND_BY_ID.get(id);
    if (!def) return { took: [] };
    const took: string[] = [];
    for (const code of def.keys) {
      const had = this.byCode.get(code);
      if (had && had !== id) {
        this.setCodes(had, this.codes(had).filter((c) => c !== code));
        took.push(had);
      }
    }
    this.setCodes(id, def.keys.slice());
    this.save();
    this.onChange?.();
    return { took };
  }

  /** Whether one thing answers to other keys than it came with. */
  isChanged(id: string): boolean {
    const def = BIND_BY_ID.get(id);
    if (!def) return false;
    const mine = this.codes(id);
    return mine.length !== def.keys.length || mine.some((c, i) => c !== def.keys[i]);
  }

  /** Back to how it came out of the box. */
  reset(tell = true): void {
    this.keys.clear();
    for (const b of BINDS) this.keys.set(b.id, b.keys.slice());
    this.reindex();
    if (tell) {
      this.save();
      this.onChange?.();
    }
  }

  /** Whether anything at all has been changed from the defaults. */
  get changed(): boolean {
    return BINDS.some((b) => this.isChanged(b.id));
  }

  private setCodes(id: string, codes: string[]): void {
    this.keys.set(id, codes.filter((c) => !!c).slice(0, MAX_KEYS));
    this.reindex();
  }

  private reindex(): void {
    this.byCode.clear();
    for (const [id, codes] of this.keys) for (const c of codes) this.byCode.set(c, id);
  }

  private save(): void {
    try {
      const out: Saved = {};
      for (const b of BINDS) out[b.id] = this.codes(b.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // A browser with storage switched off still plays; it just forgets.
    }
  }

  /**
   * What was saved, over the defaults.
   *
   * Read one binding at a time rather than wholesale: a saved table written
   * before a new thing was added has no row for it, and the default should
   * stand rather than the new thing arriving unbound.
   */
  private load(): void {
    let saved: Saved | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as Saved;
    } catch {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') return;
    for (const b of BINDS) {
      const codes = saved[b.id];
      if (!Array.isArray(codes)) continue;
      this.keys.set(b.id, codes.filter((c) => typeof c === 'string' && !keyReserved(c)).slice(0, MAX_KEYS));
    }
    /*
     * A key does one thing. A table kept with a key under two things -- the
     * Market and the Stores both had U -- leaves it with the later, which is
     * the one it reached; the earlier, left with no key, takes its own from
     * out of the box where nothing else has it.
     */
    const owner = new Map<string, string>();
    for (const b of BINDS) for (const c of this.codes(b.id)) owner.set(c, b.id);
    for (const b of BINDS) {
      const mine = this.codes(b.id);
      const kept = mine.filter((c) => owner.get(c) === b.id);
      if (kept.length === mine.length) continue;
      const back = kept.length ? kept : b.keys.filter((c) => !owner.has(c));
      for (const c of back) owner.set(c, b.id);
      this.keys.set(b.id, back.slice(0, MAX_KEYS));
    }
    this.reindex();
  }
}
