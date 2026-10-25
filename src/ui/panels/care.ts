import { clockLeft } from '../../game/boons';
import { ACTION_BY_ID, type Target } from '../../game/actions';
import {
  ageOf, CARE_BONUS, CARE_WANTING, careMul, creatureLevel, denClass, GATHER_VERB, kindName, LOAD_TRADES, maxHealth, restFor,
  SEX_MARK, SPECIES, stageOf, staminaOf, tireOf, UNFED_PACE, unfedNow, type Creature,
} from '../../game/creatures';
import { furnitureDef, FURNITURE } from '../../game/furniture';
import type { Game } from '../../game/game';
import { breedChance, GROOM_HEAL, groomGain, HUSBANDRY, mateFor, pairRefuses } from '../../game/husbandry';
import { itemDef, type Item } from '../../game/items';
import { workingQl } from '../../game/materials';
import { GEAR_SIZES, GEAR_SLOTS, gearId, gearSays, gearShare, slotName, type GearSlot } from '../../game/wildgear';
import { fitGearId } from '../../game/wildgearActions';
import { idleSays, type IdleWhy } from '../../game/workerlog';
import { percent, timeWords } from '../../game/words';
import type { MenuItem } from '../contextmenu';
import { DUE_SOON, HUNGRY_AT, HURT_AT } from './wildermon';

/**
 * The Wildermon window's Care tab: everything one of yours wants doing, worst
 * first, each with the one job that sees to it where there is one; and under
 * it the whole herd on a line each, its four meters, stage, job and gear.
 *
 * Every job here is asked for through `Game.requestAction`, the door the
 * creature menu uses, which walks to it first and asks the island (`rpc_act`).
 * Nothing is decided here that the island decides: a need is read off what the
 * island last said of the animal, and a fix is offered only where the rules the
 * menu reads would offer it.
 */

/** What one of them wants, worst first in this order. */
export type NeedKind = 'hurt' | 'hungry' | 'unfed' | 'due' | 'rest' | 'idle' | 'care' | 'gear' | 'pair';
export const NEED_KINDS: readonly NeedKind[] = ['hurt', 'hungry', 'unfed', 'due', 'rest', 'idle', 'care', 'gear', 'pair'];
/** The tag on its row. */
export const NEED_LABEL: Record<NeedKind, string> = {
  hurt: 'Hurt', hungry: 'Hungry', unfed: 'Unfed', due: 'Due', rest: 'No bed', idle: 'Idle', care: 'Care', gear: 'Gear', pair: 'Pair',
};

/** A job that sees to a need: what its button says, the action, and what it is done to. */
export interface CareFix {
  label: string;
  action: string;
  target: Target;
}

/** One thing one of them wants. `urgency` orders the list, highest first. */
export interface Need {
  kind: NeedKind;
  id: number;
  name: string;
  says: string;
  title: string;
  urgency: number;
  fix: CareFix | null;
}

/** Its health as a share of what it can carry. */
const healthShare = (g: Game, c: Creature): number => c.health / Math.max(1, maxHealth(c, g.creatures.species(c)));
/** At work on, or travelling with you: where food, a brush and gear can reach it. */
const outWithYou = (c: Creature): boolean => c.mode === 'active' || c.mode === 'deed';
/** The idle reasons that are rest, not idleness (`IdleWhy`). */
const RESTING: ReadonlySet<IdleWhy> = new Set<IdleWhy>(['rest', 'bed', 'tired', 'yielded']);

/** How many of a thing are in the pack, every stack of it. */
const packCount = (g: Game, id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);

/** The wildermon bed of a size (`FurnitureDef.den`): "Medium wildermon bed". */
export const bedKind = (size: number): string => FURNITURE.find((f) => f.den === size)?.id ?? '';
export const bedName = (size: number): string => furnitureDef(bedKind(size)).name;

/** Feeding it out of the pack: the poorest thing it eats, as the HUD's Feed does (`worstFoodFor`). */
export function feedFix(g: Game, c: Creature): CareFix | null {
  if (!outWithYou(c)) return null;
  const food = g.worstFoodFor(c);
  if (!food) return null;
  return {
    label: `Feed: ${itemDef(food.id).name.toLowerCase()} ×${packCount(g, food.id)}`,
    action: 'feed',
    target: { kind: 'creature', id: c.id, itemUid: food.uid },
  };
}

/** What a brushing would put on its care, at your husbandry and your brush (`groom`). */
const brushGain = (g: Game, brush: Item): number => groomGain(g.skills.get(HUSBANDRY), workingQl(brush.ql, brush.extra)) * g.perk('groom:care', 1);

/** Brushing it, where the rules would: a brush in the pack, its care not full, not a monster (`groom`). */
function brushFix(g: Game, c: Creature, what: 'care' | 'health'): CareFix | null {
  const brush = g.inventory.tool('brush');
  if (!brush || c.care >= 0.995 || SPECIES[c.species]?.monster || c.mode === 'wild' || c.mode === 'stored') return null;
  const label = what === 'care'
    ? `Brush: +${percent(Math.min(1 - c.care, brushGain(g, brush)))} care`
    : `Brush: +${percent(g.perk('groom:heal', GROOM_HEAL))} health`;
  return { label, action: 'groom', target: { kind: 'creature', id: c.id } };
}

/**
 * A piece of gear it has no piece in and would be the better for, of its size and in your pack: a pack on a trade that
 * carries loads (`packLoads`), a harness on one in the traces, barding on one that fights. The best of them, as a
 * fitting picks (`fit_gear_*`).
 */
export function gearFixes(g: Game, c: Creature): Array<{ slot: GearSlot; piece: Item; fix: CareFix }> {
  if (!outWithYou(c) || c.mine === false) return [];
  const def = SPECIES[c.species];
  const job = c.trade ?? def?.gathers;
  const wants: Record<GearSlot, boolean> = {
    pack: c.mode === 'deed' && !!job && LOAD_TRADES.has(job),
    harness: c.hitchedTo !== null,
    barding: c.mode === 'active' || job === 'guard' || job === 'hunt',
  };
  const out: Array<{ slot: GearSlot; piece: Item; fix: CareFix }> = [];
  for (const slot of GEAR_SLOTS) {
    if (!wants[slot] || c.gear?.[slot]) continue;
    const want = gearId(slot, denClass(c));
    const piece = g.inventory.items.filter((it) => it.id === want && !it.locked).sort((a, b) => gearShare(b) - gearShare(a) || a.uid - b.uid)[0];
    if (!piece) continue;
    out.push({
      slot, piece,
      fix: { label: `Fit: ${itemDef(piece.id).name.toLowerCase()}`, action: fitGearId(slot), target: { kind: 'creature', id: c.id, itemUid: piece.uid } },
    });
  }
  return out;
}

/** Everything one of yours wants, each with what sees to it where something does. */
export function needsOf(g: Game, c: Creature): Need[] {
  const out: Need[] = [];
  const add = (kind: NeedKind, urgency: number, says: string, title: string, fix: CareFix | null): void => {
    out.push({ kind, id: c.id, name: c.name, says, title, urgency, fix });
  };
  const top = maxHealth(c, g.creatures.species(c));
  const share = healthShare(g, c);
  if (share < HURT_AT) {
    add('hurt', 900 + (1 - share) * 100, `Health ${Math.ceil(c.health)}/${top}`, `Under ${percent(HURT_AT)} health`, brushFix(g, c, 'health'));
  }
  const unfed = c.mode === 'deed' && unfedNow(c);
  if (unfed) {
    add('unfed', 850, `Work pace ${percent(UNFED_PACE)}`, `Unfed ${timeWords(c.unfed ?? 0)}: work pace ${percent(UNFED_PACE)} until fed`, feedFix(g, c));
  } else if (c.hunger < HUNGRY_AT) {
    add('hungry', 800 + (1 - c.hunger) * 100, `Fed ${percent(Math.round(c.hunger * 100) / 100)}`, `Under ${percent(HUNGRY_AT)} fed`, feedFix(g, c));
  }
  if (c.due > 0 && c.due - g.time <= DUE_SOON) {
    const left = Math.max(0, c.due - g.time);
    add('due', 700 + (1 - left / DUE_SOON) * 50, `Due in ${clockLeft(left)}`, `Young due within ${clockLeft(DUE_SOON)}`, null);
  }
  if (c.mode === 'deed' && c.idle) {
    const size = denClass(c);
    if (c.idle.why === 'rest') {
      add('rest', 600, `Resting ${clockLeft(c.idle.n)} · no free ${bedName(size).toLowerCase()}`,
        `Rest ${timeWords(restFor(false, c))}; ${timeWords(restFor(true, c))} in a free ${bedName(size).toLowerCase()} on the settlement`, null);
    } else if (!RESTING.has(c.idle.why)) {
      const def = SPECIES[c.species];
      const said = idleSays(c.idle, c.trade ?? def?.gathers, c.carrying ? itemDef(c.carrying.id).name : null);
      add('idle', 500, said.replace(/^Idle: /, '').replace(/\.$/, ''), said, null);
    }
  }
  if (c.care < CARE_WANTING && !SPECIES[c.species]?.monster) {
    add('care', 400 + (1 - c.care) * 100, `Care ${percent(Math.round(c.care * 100) / 100)} · work ×${careMul(c).toFixed(2)}`,
      `Under ${percent(CARE_WANTING)} care. Work and learning ×${careMul(c).toFixed(2)}, ×${(1 + CARE_BONUS).toFixed(2)} at full care`, brushFix(g, c, 'care'));
  }
  // The first slot it would be the better for a piece in, of those in the pack (`gearFixes`).
  const gear = gearFixes(g, c)[0];
  if (gear) {
    const { slot, piece, fix } = gear;
    add('gear', 200, `${slotName(slot)} empty · ${gearSays(slot, piece)}`, `${itemDef(piece.id).name}, QL ${Math.round(piece.ql)}: ${gearSays(slot, piece)}`, fix);
  }
  // A pair ready to be put together, said once, from her side.
  if (c.sex === 'female' && outWithYou(c) && g.deed && c.due === 0) {
    const mate = mateFor(g, c);
    if (mate && !pairRefuses(g, c, mate)) {
      const chance = breedChance(g.skills.get(HUSBANDRY), (c.care + mate.care) / 2);
      add('pair', 100, `With ${mate.name} · success ${percent(Math.round(chance * 100) / 100)}`, `${c.name} × ${mate.name}: preview before pairing`,
        { label: 'Pair', action: 'pair_creature', target: { kind: 'creature', id: c.id } });
    }
  }
  return out;
}

/** What all of yours want, worst first, then by name. */
export function careNeeds(g: Game): Need[] {
  const all = g.creatures.yours().flatMap((c) => needsOf(g, c));
  /*
   * A piece of gear offered to as many as there are of it in the pack, the highest level first: one small pack is
   * one row, not a row for every worker it would fit.
   */
  const level = (id: number): number => {
    const c = g.creatures.get(id);
    return c ? creatureLevel(c) : 0;
  };
  const pieces = new Map<string, number>();
  const gear = all.filter((n) => n.kind === 'gear').sort((a, b) => level(b.id) - level(a.id) || a.name.localeCompare(b.name));
  const dropped = new Set<Need>();
  for (const n of gear) {
    const uid = n.fix?.target.kind === 'creature' ? n.fix.target.itemUid : undefined;
    const id = uid === undefined ? '' : g.inventory.get(uid)?.id ?? '';
    const left = pieces.get(id) ?? packCount(g, id);
    if (left <= 0) dropped.add(n);
    pieces.set(id, left - 1);
  }
  return all.filter((n) => !dropped.has(n)).sort((a, b) => b.urgency - a.urgency || level(b.id) - level(a.id) || a.name.localeCompare(b.name));
}

/** The wildermon beds of each size on your settlement, how many are free, and your workers that sleep in that size. */
export function bedCounts(g: Game): Array<{ size: number; beds: number; free: number; workers: number }> {
  return GEAR_SIZES.map((_, size) => {
    const kind = bedKind(size);
    const beds = [...g.furniture.values()].filter((f) => f.kind === kind && g.onDeed(f.x, f.y));
    return {
      size,
      beds: beds.length,
      free: beds.filter((f) => f.sleeper === undefined).length,
      workers: g.creatures.workers().filter((c) => denClass(c) === size).length,
    };
  });
}

/** Where it is, as the roster filters it. */
type Place = 'active' | 'deed' | 'stored';
const PLACE_LABEL: Record<Place, string> = { active: 'Companion', deed: 'Settlement', stored: 'Crated' };

/** Its job, as the roster says it: its trade at work, and otherwise where it is. */
export function jobOf(c: Creature): string {
  if (c.ridden) return 'Ridden';
  if (c.hitchedTo !== null) return 'In the traces';
  if (c.mode === 'deed') {
    const job = c.trade ?? SPECIES[c.species]?.gathers;
    const verb = job ? GATHER_VERB[job] : 'no task';
    return `${verb[0].toUpperCase()}${verb.slice(1)}`;
  }
  return PLACE_LABEL[c.mode as Place] ?? c.mode;
}

/** Its stage, and the bed and gear size that goes with it (`denClass`): "Stage 2 · medium". */
export function stageSays(g: Game, c: Creature): string {
  const age = ageOf(c, g.time);
  const size = GEAR_SIZES[denClass(c)];
  const stage = SPECIES[c.species]?.stages ? `Stage ${stageOf(c) + 1}` : '';
  return [age === 'grown' ? '' : age, stage, size].filter(Boolean).join(' · ');
}

/** A job asked for in turn, one at a time: walking to each, and the next once this one is done. */
interface Step {
  id: number;
  /** Worked out as it is sent, from what the pack and the animal are then. */
  fix: () => CareFix | null;
}

/** How long a sent job may take to show before the next is sent anyway: a refusal never shows at all. */
const SHOW_WAIT = 1500;

/** The Care tab. */
export class CarePanel {
  readonly el: HTMLDivElement;
  private readonly bedsEl: HTMLDivElement;
  private readonly bulk: HTMLDivElement;
  private readonly feedAll: HTMLButtonElement;
  private readonly brushAll: HTMLButtonElement;
  private readonly assignSel: HTMLButtonElement;
  private readonly stopBtn: HTMLButtonElement;
  private readonly roundEl: HTMLSpanElement;
  private readonly needHead: HTMLDivElement;
  private readonly needList: HTMLDivElement;
  private readonly herdHead: HTMLDivElement;
  private readonly herdList: HTMLDivElement;
  private readonly stageSel: HTMLSelectElement;
  private readonly jobSel: HTMLSelectElement;
  private readonly idleBtn: HTMLButtonElement;
  private readonly needsBtn: HTMLButtonElement;
  private readonly needRows = new Map<string, { el: HTMLDivElement; refresh: (n: Need) => void }>();
  private readonly herdRows = new Map<number, { el: HTMLDivElement; refresh: (c: Creature, needs: Need[]) => void }>();
  /** Picked for Assign selected. */
  readonly selected = new Set<number>();
  private onlyIdle = false;
  private onlyNeeds = false;
  private jobKey = '';
  /** A bulk job under way: what is left, what it says, and the one sent last. */
  private round: { steps: Step[]; label: string; done: number; total: number; sentAt: number; busySeen: boolean; instant: boolean } | null = null;

  constructor(
    private readonly game: Game,
    private readonly entriesFor: (id: number) => MenuItem[],
    private readonly showMenu: (x: number, y: number, title: string, items: MenuItem[]) => void,
  ) {
    const el = document.createElement('div');
    el.className = 'care-page';
    this.el = el;

    this.bulk = document.createElement('div');
    this.bulk.className = 'panel-bar care-bulk';
    const button = (text: string, title: string, on: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small';
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', on);
      return b;
    };
    this.feedAll = button('Feed hungry', `Under ${percent(HUNGRY_AT)} fed or unfed: poorest food in pack, one at a time`, () => this.startFeed());
    this.brushAll = button('Brush', `Under ${percent(CARE_WANTING)} care or ${percent(HURT_AT)} health: one brushing each, one at a time`, () => this.startBrush());
    this.assignSel = button('Assign selected', 'Assign to settlement: each ticked companion', () => this.startAssign());
    this.stopBtn = button('Stop', 'Stop the bulk job', () => this.stop());
    this.stopBtn.hidden = true;
    this.roundEl = document.createElement('span');
    this.roundEl.className = 'care-round';
    this.bulk.append(this.feedAll, this.brushAll, this.assignSel, this.stopBtn, this.roundEl);

    this.bedsEl = document.createElement('div');
    this.bedsEl.className = 'care-beds';

    this.needHead = document.createElement('div');
    this.needHead.className = 'inv-group';
    this.needList = document.createElement('div');
    this.needList.className = 'care-needs';

    this.herdHead = document.createElement('div');
    this.herdHead.className = 'inv-group';
    const filters = document.createElement('div');
    filters.className = 'panel-bar care-filters';
    this.stageSel = document.createElement('select');
    this.stageSel.className = 'panel-select';
    this.stageSel.title = 'Bed and gear size';
    for (const [v, label] of [['', 'All sizes'], ...GEAR_SIZES.map((s, i) => [String(i), `${s[0].toUpperCase()}${s.slice(1)}`])]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      this.stageSel.append(o);
    }
    this.jobSel = document.createElement('select');
    this.jobSel.className = 'panel-select';
    this.jobSel.title = 'Job';
    this.stageSel.addEventListener('change', () => this.render());
    this.jobSel.addEventListener('change', () => this.render());
    const toggle = (text: string, title: string, flip: () => boolean): HTMLButtonElement => {
      const b = button(text, title, () => {
        const on = flip();
        b.classList.toggle('tb-on', on);
        b.setAttribute('aria-pressed', String(on));
        this.render();
      });
      b.setAttribute('aria-pressed', 'false');
      return b;
    };
    this.idleBtn = toggle('Idle', 'Workers idle or resting only', () => (this.onlyIdle = !this.onlyIdle));
    this.needsBtn = toggle('Needs', 'With a need only', () => (this.onlyNeeds = !this.onlyNeeds));
    filters.append(this.stageSel, this.jobSel, this.idleBtn, this.needsBtn);
    this.herdList = document.createElement('div');
    this.herdList.className = 'care-herd';

    el.append(this.bulk, this.bedsEl, this.needHead, this.needList, this.herdHead, filters, this.herdList);
  }

  /** Put a list in this order, moving as little as possible (as the cards are, `WildermonPanel.place`). */
  private static place(list: HTMLElement, want: Node[]): void {
    for (let i = 0; i < want.length; i++) {
      if (list.childNodes[i] === want[i]) continue;
      list.insertBefore(want[i], list.childNodes[i] ?? null);
    }
    while (list.childNodes.length > want.length) list.lastChild?.remove();
  }

  /** Ask for one job, as the menu does. */
  private ask(fix: CareFix): void {
    const def = ACTION_BY_ID.get(fix.action);
    if (def) this.game.requestAction(def, fix.target);
  }

  /* ---- bulk jobs ------------------------------------------------------------ */

  /** Start one job after another, from the first. */
  private begin(label: string, steps: Step[], instant = false): void {
    if (!steps.length) return;
    this.round = { steps, label, done: 0, total: steps.length, sentAt: -Infinity, busySeen: true, instant };
    this.stopBtn.hidden = false;
    this.update(performance.now());
  }

  /** Every one of them that is hungry or unfed, with food for it in the pack. */
  feedTargets(): number[] {
    return careNeeds(this.game).filter((n) => (n.kind === 'hungry' || n.kind === 'unfed') && n.fix).map((n) => n.id);
  }

  /** Every one of them under care or health that a brushing would help. */
  brushTargets(): number[] {
    return [...new Set(careNeeds(this.game).filter((n) => (n.kind === 'care' || n.kind === 'hurt') && n.fix?.action === 'groom').map((n) => n.id))];
  }

  /** The ticked ones that can be assigned to the settlement (`assign_deed`). */
  assignTargets(): number[] {
    const def = ACTION_BY_ID.get('assign_deed');
    return [...this.selected].filter((id) => !!def && def.applies({ kind: 'creature', id }, this.game) && this.game.creatures.get(id)?.mode !== 'deed');
  }

  startFeed(): void {
    this.begin('Feeding', this.feedTargets().map((id) => ({ id, fix: () => {
      const c = this.game.creatures.get(id);
      return c && (c.hunger < HUNGRY_AT || unfedNow(c)) ? feedFix(this.game, c) : null;
    } })));
  }

  startBrush(): void {
    this.begin('Brushing', this.brushTargets().map((id) => ({ id, fix: () => {
      const c = this.game.creatures.get(id);
      return c ? brushFix(this.game, c, 'care') : null;
    } })));
  }

  startAssign(): void {
    this.begin('Assigning', this.assignTargets().map((id) => ({ id, fix: () => ({ label: 'Assign', action: 'assign_deed', target: { kind: 'creature', id } }) })), true);
    this.selected.clear();
  }

  stop(): void {
    this.round = null;
    this.stopBtn.hidden = true;
    this.roundEl.textContent = '';
  }

  /** Whether anything is in hand: a job, a walk to one, or jobs lined up. */
  private busy(): boolean {
    const g = this.game;
    return !!g.action || g.queue.length > 0 || !!g.player.path;
  }

  /**
   * The next job of a bulk one, once the last is done: the game has been busy with it and is not now, or it never
   * showed at all (refused, or instant) in `SHOW_WAIT`.
   */
  step(now: number): void {
    const r = this.round;
    if (!r) return;
    const busy = this.busy();
    if (busy) {
      r.busySeen = true;
      return;
    }
    if (!r.busySeen && now - r.sentAt < (r.instant ? SHOW_WAIT / 4 : SHOW_WAIT)) return;
    while (r.steps.length) {
      const s = r.steps.shift()!;
      r.done++;
      const fix = s.fix();
      if (!fix) continue;
      r.sentAt = now;
      r.busySeen = false;
      this.ask(fix);
      return;
    }
    this.stop();
  }

  /* ---- drawing -------------------------------------------------------------- */

  update(now: number): void {
    this.step(now);
    this.render();
  }

  render(): void {
    const g = this.game;
    const needs = careNeeds(g);
    const r = this.round;
    const says = r ? `${r.label} ${Math.min(r.done, r.total)}/${r.total}` : '';
    if (this.roundEl.textContent !== says) this.roundEl.textContent = says;
    const feed = r ? 0 : this.feedTargets().length;
    const brush = r ? 0 : this.brushTargets().length;
    const assign = r ? 0 : this.assignTargets().length;
    const label = (b: HTMLButtonElement, text: string, n: number): void => {
      const t = `${text} (${n})`;
      if (b.textContent !== t) b.textContent = t;
      b.disabled = n === 0;
    };
    label(this.feedAll, 'Feed hungry', feed);
    label(this.brushAll, 'Brush', brush);
    label(this.assignSel, 'Assign selected', assign);

    // The beds on the settlement, by size, against the workers that sleep in each.
    const beds = g.deed ? bedCounts(g).filter((b) => b.beds || b.workers) : [];
    const bedSays = beds.length
      ? `Beds: ${beds.map((b) => `${GEAR_SIZES[b.size]} ${b.beds} (free ${b.free}, workers ${b.workers})`).join(' · ')}`
      : '';
    if (this.bedsEl.textContent !== bedSays) this.bedsEl.textContent = bedSays;
    this.bedsEl.title = `${bedName(0)}, ${bedName(1).toLowerCase()}, ${bedName(2).toLowerCase()}: rest ${timeWords(restFor(true))} in a free bed of its size, ${timeWords(restFor(false))} without`;
    this.bedsEl.classList.toggle('care-short', beds.some((b) => b.workers > b.beds));
    this.bedsEl.hidden = !bedSays;

    const head = `Needs (${needs.length})`;
    if (this.needHead.textContent !== head) this.needHead.textContent = head;
    const wantNeeds: Node[] = [];
    const keys = new Set<string>();
    for (const n of needs) {
      const key = `${n.kind}:${n.id}`;
      keys.add(key);
      let row = this.needRows.get(key);
      if (!row) {
        row = this.needRow();
        this.needRows.set(key, row);
      }
      row.refresh(n);
      wantNeeds.push(row.el);
    }
    if (!needs.length) wantNeeds.push(this.emptyNote());
    CarePanel.place(this.needList, wantNeeds);
    for (const key of [...this.needRows.keys()]) if (!keys.has(key)) this.needRows.delete(key);

    // The herd, filtered.
    const yours = g.creatures.yours().sort((a, b) => a.name.localeCompare(b.name));
    this.jobOptions(yours);
    const size = this.stageSel.value;
    const job = this.jobSel.value;
    const byId = new Map<number, Need[]>();
    for (const n of needs) byId.set(n.id, [...(byId.get(n.id) ?? []), n]);
    const shown = yours.filter((c) => (size === '' || String(denClass(c)) === size)
      && (job === '' || jobOf(c) === job)
      && (!this.onlyIdle || (c.mode === 'deed' && !!c.idle))
      && (!this.onlyNeeds || byId.has(c.id)));
    const herd = `Herd (${shown.length === yours.length ? yours.length : `${shown.length}/${yours.length}`})`;
    if (this.herdHead.textContent !== herd) this.herdHead.textContent = herd;
    const wantHerd: Node[] = [];
    for (const c of shown) {
      let row = this.herdRows.get(c.id);
      if (!row) {
        row = this.herdRow(c.id);
        this.herdRows.set(c.id, row);
      }
      row.refresh(c, byId.get(c.id) ?? []);
      wantHerd.push(row.el);
    }
    CarePanel.place(this.herdList, wantHerd);
    const alive = new Set(yours.map((c) => c.id));
    for (const id of [...this.herdRows.keys()]) if (!alive.has(id)) this.herdRows.delete(id);
    for (const id of [...this.selected]) if (!alive.has(id)) this.selected.delete(id);
  }

  private empty: HTMLDivElement | null = null;
  private emptyNote(): HTMLDivElement {
    if (!this.empty) {
      this.empty = document.createElement('div');
      this.empty.className = 'inv-empty';
    }
    const n = this.game.creatures.yours().length;
    const t = n ? `None of ${n} wildermon` : 'No tamed wildermon';
    if (this.empty.textContent !== t) this.empty.textContent = t;
    return this.empty;
  }

  /** The job filter's choices: every job in the herd, kept until the herd changes. */
  private jobOptions(yours: Creature[]): void {
    const jobs = [...new Set(yours.map(jobOf))].sort();
    const key = jobs.join('|');
    if (key === this.jobKey) return;
    this.jobKey = key;
    const was = this.jobSel.value;
    this.jobSel.replaceChildren();
    for (const [v, label] of [['', 'All jobs'], ...jobs.map((j) => [j, j])]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      this.jobSel.append(o);
    }
    this.jobSel.value = jobs.includes(was) ? was : '';
  }

  /** A row of the needs list: who, what and why, and the button that sees to it. */
  private needRow(): { el: HTMLDivElement; refresh: (n: Need) => void } {
    let cur: Need | null = null;
    const el = document.createElement('div');
    el.className = 'care-need';
    const tag = document.createElement('span');
    tag.className = 'pal-flag care-tag';
    const who = document.createElement('span');
    who.className = 'care-who';
    const says = document.createElement('span');
    says.className = 'care-says';
    const fix = document.createElement('button');
    fix.type = 'button';
    fix.className = 'tb-btn tb-small care-fix';
    fix.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cur?.fix) this.ask(cur.fix);
    });
    el.append(tag, who, says, fix);
    const refresh = (n: Need): void => {
      cur = n;
      const t = NEED_LABEL[n.kind];
      if (tag.textContent !== t) tag.textContent = t;
      const cls = `pal-flag care-tag care-tag-${n.kind}`;
      if (tag.className !== cls) tag.className = cls;
      if (who.textContent !== n.name) who.textContent = n.name;
      if (says.textContent !== n.says) says.textContent = n.says;
      if (says.title !== n.title) says.title = n.title;
      const label = n.fix?.label ?? '';
      if (fix.textContent !== label) fix.textContent = label;
      fix.hidden = !n.fix;
      el.dataset.kind = n.kind;
      el.dataset.id = String(n.id);
    };
    return { el, refresh };
  }

  /** A row of the herd: a tick for bulk jobs, who, its stage, job and gear, its four meters, and its menu. */
  private herdRow(id: number): { el: HTMLDivElement; refresh: (c: Creature, needs: Need[]) => void } {
    let cur: Creature | null = null;
    const el = document.createElement('div');
    el.className = 'care-row';
    el.dataset.id = String(id);
    const head = document.createElement('div');
    head.className = 'care-row-head';
    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.className = 'care-tick';
    tick.title = 'Select for Assign selected';
    tick.addEventListener('change', () => {
      if (tick.checked) this.selected.add(id);
      else this.selected.delete(id);
      this.render();
    });
    const name = document.createElement('span');
    name.className = 'care-name';
    const flags = document.createElement('span');
    flags.className = 'pal-flags';
    const level = document.createElement('span');
    level.className = 'pal-level';
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'tb-btn tb-small';
    menu.textContent = '⋯';
    menu.title = 'Actions';
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!cur) return;
      const r = menu.getBoundingClientRect();
      this.showMenu(r.left, r.bottom + 2, cur.name, this.entriesFor(cur.id));
    });
    head.append(tick, name, flags, level, menu);
    const job = document.createElement('div');
    job.className = 'care-job';
    const meters = document.createElement('div');
    meters.className = 'care-meters';
    const meter = (label: string, cls: string): { fill: HTMLDivElement; value: HTMLSpanElement; box: HTMLDivElement } => {
      const box = document.createElement('div');
      box.className = 'care-meter';
      const l = document.createElement('span');
      l.className = 'care-meter-label';
      l.textContent = label;
      const track = document.createElement('div');
      track.className = 'hud-bar';
      const fill = document.createElement('div');
      fill.className = `hud-bar-fill ${cls}`;
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'care-meter-value';
      box.append(l, track, value);
      meters.append(box);
      return { fill, value, box };
    };
    const fed = meter('Fed', 'bar-hunger');
    const rest = meter('Rest', 'bar-stamina');
    const health = meter('Health', 'bar-health');
    const care = meter('Care', 'bar-care');
    el.append(head, job, meters);

    const width = (fill: HTMLDivElement, v: number): void => {
      const w = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
      if (fill.style.width !== w) fill.style.width = w;
    };
    const say = (e: HTMLElement, t: string): void => {
      if (e.textContent !== t) e.textContent = t;
    };
    const refresh = (c: Creature, needs: Need[]): void => {
      cur = c;
      const g = this.game;
      say(name, `${SEX_MARK[c.sex]} ${c.name}`);
      say(level, `Lv ${creatureLevel(c)}`);
      const flagKey = needs.map((n) => n.kind).join();
      if (flags.dataset.says !== flagKey) {
        flags.dataset.says = flagKey;
        flags.replaceChildren(...needs.filter((n) => n.kind !== 'gear' && n.kind !== 'pair').map((n) => {
          const t = document.createElement('span');
          t.className = `pal-flag care-tag-${n.kind}`;
          t.textContent = NEED_LABEL[n.kind];
          return t;
        }));
      }
      el.classList.toggle('care-row-wants', needs.some((n) => n.urgency >= 500));
      if (tick.checked !== this.selected.has(c.id)) tick.checked = this.selected.has(c.id);
      const gear = GEAR_SLOTS.filter((s) => c.gear?.[s]).map((s) => slotName(s));
      say(job, [kindName(c), jobOf(c), stageSays(g, c), gear.length ? `Gear: ${gear.join(', ')}` : ''].filter(Boolean).join(' · '));
      const top = maxHealth(c, g.creatures.species(c));
      width(fed.fill, c.hunger);
      say(fed.value, percent(Math.round(c.hunger * 100) / 100));
      // Stamina, which only a worker spends (`TIRE_GOES`): its goes left of its goes.
      const works = c.mode === 'deed';
      width(rest.fill, works ? staminaOf(c) : 0);
      say(rest.value, works ? `${Math.max(0, tireOf(c) - (c.worn ?? 0))}/${tireOf(c)}` : '–');
      rest.box.title = works ? `Cycles before it rests; rest ${timeWords(restFor(false, c))}, ${timeWords(restFor(true, c))} in a ${bedName(denClass(c)).toLowerCase()}` : 'Workers only';
      width(health.fill, c.health / top);
      say(health.value, `${Math.ceil(c.health)}/${top}`);
      width(care.fill, c.care);
      say(care.value, percent(Math.round(c.care * 100) / 100));
      care.box.title = `Work and learning ×${careMul(c).toFixed(2)}, ×${(1 + CARE_BONUS).toFixed(2)} at full care`;
      el.hidden = false;
    };
    return { el, refresh };
  }
}

