import { clockLeft } from '../../game/boons';
import { gearTags } from '../../game/wildgearActions';
import { DAY_SECONDS } from '../../game/game';
import { ageDef, BASE_STATS, BRACE_MOST, BRACE_STEP, bracePoints, BRIDLE_PACE, COLLAR_CUT, fitted, mirrored, mirrorNames, POT_MOST, POT_STEP, potMul, potPoints, type BaseStat, CARE_WANTING, GESTATION, isShod, SHOE_DAYS, ageOf, attackOf, bloodMul, CARE_BONUS, careMul, careWord, favouriteSays, fedNow, wellFedSays, growsAt, creatureLevel, kindName, GATHER_VERB, maxHealth, pedigreeLine, RANGE_PER_STEP, rarityLine, rarityMul, SEX_MARK, SEX_NAMES, SKILL_STEP, SPECIES, STANCE_NAMES, taskSkill, workRangeOf, type Creature, lineLines } from '../../game/creatures';
import { CHANNELS, isGain, mirrorTrait, pct, TIER_CSS, TRAIT_SOURCES, traitMul, traitOf, type TraitChannel, lineMul } from '../../game/traits';
import { readsTrait, TIER_LEVEL, traitReadNeeds } from '../../game/husbandry';

import type { Game } from '../../game/game';
import { itemDef, rarityOf } from '../../game/items';
import { furnitureDef } from '../../game/furniture';
import { SKILL_BY_ID } from '../../game/skills';
import type { MenuItem } from '../contextmenu';
import type { UIWindow } from '../windows';
import { percent } from '../../game/words';
import { idleSays, ledgerLines } from '../../game/workerlog';
import { workLines } from '../../game/workstats';
import { formLabels } from '../../game/wildforms';

/**
 * Where a wildermon is, as the list groups it: under a rider or in a
 * vehicle's traces first, whatever it was doing before, and only otherwise
 * by what it was told to do.
 *
 * Reported: two seavics hitched to one wagon were listed apart, one under
 * "Travelling with you" and one under "Working the deed", because the list
 * went by the order each had been given before it was hitched. In the traces
 * it does neither -- it goes where the wagon is taken (`Creatures.update`) --
 * and goes back to its order when it is taken out.
 */
type Place = Creature['mode'] | 'saddle' | 'traces';
const placeOf = (c: Creature): Place => (c.ridden ? 'saddle' : c.hitchedTo !== null ? 'traces' : c.mode);
const GROUPS: Array<[Place, string]> = [
  ['saddle', 'Ridden'],
  ['traces', 'In the traces'],
  ['active', 'Companion'],
  ['deed', 'Working the settlement'],
  ['stored', 'In wildermon crates'],
];

/** How a herd may be put in order. */
type SortKey = 'name' | 'level' | 'species' | 'health' | 'hunger' | 'care' | 'age' | 'traits';
/** Each says which end comes first, since half of them climb and half fall (`ordered`). */
const SORTS: Array<[SortKey, string]> = [
  ['name', 'Name, A–Z'],
  ['level', 'Highest level'],
  ['species', 'Kind, A–Z'],
  ['health', 'Most hurt'],
  ['hunger', 'Hungriest'],
  ['care', 'Best cared for'],
  ['age', 'Oldest'],
  ['traits', 'Best trait'],
];

/**
 * What counts as wanting attention. The footer has always counted these and
 * the cards never said which ones they were, so the count sent you looking
 * through the herd by eye. One definition, read by both, so they cannot drift.
 */
export const HURT_AT = 0.6;
export const HUNGRY_AT = 0.3;
/** A dam due within this many seconds wants attention too: a quarter of her carrying. */
export const DUE_SOON = GESTATION / 4;

/**
 * Its four base stats as the rules read them now (`BASE_STATS`), each with
 * what ancient pots have put into it: "Attack 4.4 (+2 of 10 from ancient
 * pots)". Health is the health it can carry (`maxHealth`), attack what a blow
 * of its lands for (`attackOf`), speed its pace on its feet in tiles a second
 * at its age (what `Creatures.update` walks it at), and work how much quicker
 * than its kind it gets a go of its task done (`workMul`). Read off the same
 * functions the rules call, so the card cannot say one thing while the rules
 * do another.
 */
export function baseStatTags(g: Game, c: Creature): Array<{ stat: BaseStat; text: string; title: string }> {
  const def = SPECIES[c.species] ?? SPECIES.rabba;
  const figure: Record<BaseStat, string> = {
    hardy: `${maxHealth(c, def)}`,
    tough: `${attackOf(c, def).toFixed(attackOf(c, def) % 1 ? 1 : 0)} damage`,
    speed: `${(def.speed * ageDef(c, g.time).speed * g.creatures.speedMul(c)).toFixed(2)} tiles/s`,
    work: `\u00d7${g.creatures.workMul(c).toFixed(2)}`,
  };
  return BASE_STATS.map((s) => {
    const n = potPoints(c, s.id);
    return {
      stat: s.id,
      text: `${s.name} ${figure[s.id]}${n ? ` (+${n} of ${POT_MOST} from ancient pots)` : ''}`,
      title: `${s.name}: ${s.says}.${n ? ` Ancient pots: ${n}/${POT_MOST} points, +${percent(POT_STEP * n)}.` : ''}`
        + ` Ancient pot: +1 point to a random base stat, +${percent(POT_STEP)} each, max ${POT_MOST} a stat.`,
    };
  });
}

/** An ancient collar and bridle fitted on it, its brace uses and a bronze mirror's mark, for the Stats row: "Collar: upkeep −20%". */
export function fittedTags(g: Game, c: Creature): Array<{ text: string; title: string }> {
  const out: Array<{ text: string; title: string }> = [];
  // A bronze mirror's mark: the trait it would copy, named where your husbandry reads it, as on the card.
  const copy = mirrored(c) ? mirrorTrait(c.traits) : null;
  if (copy) {
    const what = readsTrait(g, copy) ? mirrorNames(copy) : 'best trait (unreadable)';
    out.push({ text: `Mirror: ${what} to its next young`, title: `Bronze mirror: its next covering's young get ${what}, in place of a draw. Mark used up at that covering.` });
  }
  if (fitted(c, 'collar')) out.push({ text: `Collar: upkeep −${percent(COLLAR_CUT)}`, title: `Ancient collar: hunger rate −${percent(COLLAR_CUT)}.` });
  const brace = bracePoints(c);
  if (brace) out.push({ text: `Brace: action speed +${percent(BRACE_STEP * brace)} (${brace}/${BRACE_MOST})`, title: `Ancient brace: ${brace} of ${BRACE_MOST} uses, action speed +${percent(BRACE_STEP)} each.` });
  if (fitted(c, 'bridle')) out.push({ text: `Bridle: ridden and team speed +${percent(BRIDLE_PACE)}`, title: `Ancient bridle: speed ridden and in a team +${percent(BRIDLE_PACE)}, past the speed cap.` });
  return out;
}

/** Your tamed wildermon with their condition, progress and actions. Wild ones are not listed. */
export class WildermonPanel {
  private list: HTMLDivElement;
  private footer: HTMLDivElement;
  private search: HTMLInputElement;
  private query = '';
  private sort: SortKey = 'name';
  private sortSel!: HTMLSelectElement;
  private groupBtn!: HTMLButtonElement;
  private grouped = true;
  /** Only the ones that want something doing: hungry, hurt, wanting a brush, or about to give birth. */
  private attention = false;
  private attentionBtn!: HTMLButtonElement;
  private lastRender = 0;
  /**
   * The cards on screen, by the wildermon each one is for, and the group
   * headings above them.
   *
   * Reported: "hard to press the buttons and it scrolls constantly to the
   * bottom." The list was thrown away and built again every 400 ms --
   * `replaceChildren` and thirty fresh cards, two and a half times a second --
   * and a button that is destroyed between the press and the release is a
   * button that was never clicked. That is the whole of why they were hard to
   * press: the ⋯ on every card, and the two in the footer, were new elements
   * by the time the mouse came back up.
   *
   * So nothing is thrown away now. A card is built once and brought up to date
   * in place, and the list is reconciled against the order it should be in:
   * a wildermon that has not moved in the order is not touched at all.
   */
  private readonly cards = new Map<number, { el: HTMLDivElement; refresh: (c: Creature) => void }>();
  private readonly heads = new Map<string, HTMLDivElement>();
  private footerKey = '';

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly entriesFor: (id: number) => MenuItem[],
    private readonly showMenu: (x: number, y: number, title: string, items: MenuItem[]) => void,
  ) {
    win.body.classList.add('pals-body');
    // A herd of thirty is a scroll; searching and ordering it is the point.
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search';
    this.search.placeholder = 'Name, kind, trait, task…';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      this.search.value = '';
      this.query = '';
      this.render();
    });
    const bar = document.createElement('div');
    bar.className = 'panel-bar';
    const sortSel = document.createElement('select');
    sortSel.className = 'panel-select';
    sortSel.title = 'Sort';
    for (const [key, label] of SORTS) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      sortSel.append(opt);
    }
    this.sortSel = sortSel;
    sortSel.addEventListener('change', () => {
      this.sort = sortSel.value as SortKey;
      this.render();
    });
    const groupBtn = document.createElement('button');
    this.groupBtn = groupBtn;
    groupBtn.type = 'button';
    groupBtn.className = 'tb-btn tb-small tb-on';
    groupBtn.textContent = 'Grouped';
    groupBtn.title = 'Group by location, or one list';
    groupBtn.addEventListener('click', () => {
      this.grouped = !this.grouped;
      groupBtn.textContent = this.grouped ? 'Grouped' : 'Flat';
      groupBtn.classList.toggle('tb-on', this.grouped);
      this.render();
    });
    const attentionBtn = document.createElement('button');
    this.attentionBtn = attentionBtn;
    attentionBtn.type = 'button';
    attentionBtn.className = 'tb-btn tb-small';
    attentionBtn.textContent = 'Needs attention';
    attentionBtn.title = `Only those under ${Math.round(HUNGRY_AT * 100)}% fed, under ${Math.round(HURT_AT * 100)}% health, `
      + `under ${Math.round(CARE_WANTING * 100)}% care, or due within ${clockLeft(DUE_SOON)}`;
    attentionBtn.setAttribute('aria-pressed', 'false');
    attentionBtn.addEventListener('click', () => this.showAttention(!this.attention));
    bar.append(sortSel, groupBtn, attentionBtn);
    this.list = document.createElement('div');
    this.list.className = 'pals-list';
    this.footer = document.createElement('div');
    this.footer.className = 'inv-footer';
    win.body.append(this.search, bar, this.list, this.footer);
    this.render();
  }

  /** Everything one of them answers to: its name, kind, job, orders and traits. */
  private matches(c: Creature): boolean {
    if (!this.query) return true;
    const def = SPECIES[c.species] ?? SPECIES.rabba;
    const traits = c.traits.map((id) => traitOf(id)?.name ?? '').join(' ');
    const age = ageOf(c, this.game.time);
    const job = def.gathers ? GATHER_VERB[def.gathers] : '';
    return `${c.name} ${def.name} ${c.mode} ${placeOf(c)} ${c.stance} ${job} ${SEX_NAMES[c.sex]} ${age} ${traits}`.toLowerCase().includes(this.query);
  }

  /** The best tier any of its traits reached, for ordering by breeding. */
  private bestTier(c: Creature): number {
    let best = -1;
    for (const id of c.traits) {
      const t = traitOf(id);
      if (t) best = Math.max(best, TIER_LEVEL[t.tier]);
    }
    return best;
  }

  /** The order asked for: name and kind climb, everything else falls. */
  private ordered(list: Creature[]): Creature[] {
    const by: Record<SortKey, (a: Creature, b: Creature) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      level: (a, b) => creatureLevel(b) - creatureLevel(a),
      species: (a, b) => (SPECIES[a.species]?.name ?? '').localeCompare(SPECIES[b.species]?.name ?? '') || a.name.localeCompare(b.name),
      health: (a, b) => a.health / maxHealth(a, this.game.creatures.species(a)) - b.health / maxHealth(b, this.game.creatures.species(b)),
      hunger: (a, b) => a.hunger - b.hunger,
      care: (a, b) => b.care - a.care,
      age: (a, b) => a.born - b.born,
      traits: (a, b) => this.bestTier(b) - this.bestTier(a) || creatureLevel(b) - creatureLevel(a),
    };
    return [...list].sort(by[this.sort]);
  }

  /** Redraw a few times a second while open; stats move constantly. */
  update(now: number): void {
    if (!this.win.isOpen || now - this.lastRender < 400) return;
    this.lastRender = now;
    this.render();
  }

  /**
   * Put the list in this order, moving as little as possible.
   *
   * `insertBefore` on a node already in the tree moves it rather than copying
   * it, so a card that is already where it should be is not touched, and one
   * that has only changed places keeps its identity, its listeners and the
   * press that is halfway through happening on it.
   */
  private place(want: Node[]): void {
    for (let i = 0; i < want.length; i++) {
      if (this.list.childNodes[i] === want[i]) continue;
      this.list.insertBefore(want[i], this.list.childNodes[i] ?? null);
    }
    while (this.list.childNodes.length > want.length) this.list.lastChild?.remove();
  }

  /** A group heading, kept between renders so the list has nothing to rebuild. */
  private heading(mode: string, text: string): HTMLDivElement {
    let el = this.heads.get(mode);
    if (!el) {
      el = document.createElement('div');
      el.className = 'inv-group';
      this.heads.set(mode, el);
    }
    if (el.textContent !== text) el.textContent = text;
    return el;
  }

  /** A line that is only ever a sentence: built once, worded as needed. */
  private note(mode: string, text: string): HTMLDivElement {
    const el = this.heading(`note:${mode}`, text);
    el.className = 'inv-empty';
    return el;
  }

  render(): void {
    const owned = this.game.creatures.yours();
    const shown = owned.filter((c) => this.matches(c) && (!this.attention || this.wants(c)));
    if (!owned.length) {
      this.place([this.note('none', `No tamed wildermon. Tame: a berry for a ${SPECIES.rabba.name}, a spice for a ${SPECIES.vola.name}.`)]);
      this.footer.replaceChildren();
      this.footerKey = '';
      return;
    }
    const want: Node[] = [];
    const take = (c: Creature): void => {
      let held = this.cards.get(c.id);
      if (!held) {
        held = this.card(c);
        this.cards.set(c.id, held);
      }
      held.refresh(c);
      want.push(held.el);
    };
    if (!this.grouped) {
      for (const c of this.ordered(shown)) take(c);
    } else
    for (const [mode, title] of GROUPS) {
      const group = shown.filter((c) => placeOf(c) === mode);
      if (!group.length) continue;
      want.push(this.heading(mode, `${title} (${group.length})`));
      for (const c of this.ordered(group)) take(c);
    }
    if (!shown.length) {
      want.push(this.attention
        ? this.note('search', `None of your ${owned.length} wildermon need attention.${this.query ? ` (Search: “${this.search.value.trim()}”.)` : ''}`)
        : this.note('search', `No wildermon match “${this.search.value.trim()}”.`));
    }
    this.place(want);
    // Cards for wildermon that are no longer any of ours are let go, so a herd
    // that changes hands does not leave the map growing for the session.
    if (this.cards.size > owned.length) {
      const alive = new Set(owned.map((c) => c.id));
      for (const id of [...this.cards.keys()]) if (!alive.has(id)) this.cards.delete(id);
    }

    const hungry = owned.filter((c) => this.isHungry(c)).length;
    const hurt = owned.filter((c) => this.isHurt(c)).length;
    const wanting = owned.filter((c) => this.wants(c)).length;
    /*
     * The footer carries two buttons of its own, so it is rebuilt only when
     * what it says has actually changed -- which is when one of these three
     * numbers moves, and not two and a half times a second.
     */
    const key = `${shown.length}/${owned.length}|${hungry}|${hurt}|${wanting}|${this.attention}`;
    if (key !== this.footerKey) {
      this.footerKey = key;
      this.footer.replaceChildren();
      const count = document.createElement('span');
      count.textContent = `${shown.length === owned.length ? owned.length : `${shown.length} of ${owned.length}`} wildermon`;
      this.footer.append(count);
      // A count of things wrong is only useful if it takes you to them.
      const jump = (n: number, what: string, sort: SortKey): void => {
        if (!n) return;
        this.footer.append(document.createTextNode(' · '));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `pal-jump pal-flag-${what}`;
        b.textContent = `${n} ${what}`;
        b.title = `Show all: worst first, ungrouped, unfiltered`;
        b.addEventListener('click', () => this.findThose(sort));
        this.footer.append(b);
      };
      jump(hungry, 'hungry', 'hunger');
      jump(hurt, 'hurt', 'health');
      // Everything wanting attention at once, which is the view the button above turns on.
      if (wanting && !this.attention) {
        this.footer.append(document.createTextNode(' · '));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pal-jump';
        b.textContent = `${wanting} want attention`;
        b.title = this.attentionBtn.title;
        b.addEventListener('click', () => this.showAttention(true));
        this.footer.append(b);
      }
      this.footer.classList.toggle('inv-over', hungry > 0 || hurt > 0);
    }
  }

  /** Wanting something done: hungry, hurt, wanting a brush, or about to give birth. */
  private wants(c: Creature): boolean {
    return this.isHungry(c) || this.isHurt(c) || c.care < CARE_WANTING || (c.due > 0 && c.due - this.game.time <= DUE_SOON);
  }

  /** Turn the Needs attention view on or off. */
  private showAttention(on: boolean): void {
    this.attention = on;
    this.attentionBtn.classList.toggle('tb-on', on);
    this.attentionBtn.setAttribute('aria-pressed', String(on));
    this.render();
  }

  /** Hurt enough to be worth doing something about. */
  private isHurt(c: Creature): boolean {
    return c.health < maxHealth(c, this.game.creatures.species(c)) * HURT_AT;
  }

  private isHungry(c: Creature): boolean {
    return c.hunger < HUNGRY_AT;
  }

  /**
   * Bring whatever wants attention to the top, and stop hiding any of it
   * behind a search. What the footer counts, this finds.
   */
  private findThose(sort: SortKey): void {
    this.sort = sort;
    this.sortSel.value = sort;
    this.search.value = '';
    this.query = '';
    this.grouped = false;
    this.groupBtn.textContent = 'Flat';
    this.groupBtn.classList.remove('tb-on');
    this.render();
  }

  /**
   * One card, built once, and how to bring it up to date.
   *
   * Everything a card shows moves -- health, hunger, care, what it is carrying
   * -- so a card compared against its old self would differ on nearly every
   * render, and comparing was never going to save the buttons. What saves them
   * is not replacing anything: the structure is made here and `refresh` writes
   * the new figures into it, so the ⋯ button is the same element from the day
   * the card appears until the wildermon is gone.
   */
  private card(c: Creature): { el: HTMLDivElement; refresh: (c: Creature) => void } {
    let cur = c;
    const card = document.createElement('div');
    card.className = 'pal-card';
    const head = document.createElement('div');
    head.className = 'pal-head';
    const name = document.createElement('span');
    name.className = 'pal-name';
    const level = document.createElement('span');
    level.className = 'pal-level';
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'tb-btn tb-small';
    menu.textContent = '⋯';
    menu.title = 'Actions';
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = menu.getBoundingClientRect();
      this.showMenu(r.left, r.bottom + 2, cur.name, this.entriesFor(cur.id));
    });
    const flags = document.createElement('span');
    flags.className = 'pal-flags';
    head.append(name, flags, level, menu);
    // How rare it came into the world, in its rarity's colour, and what that makes of it:
    // the rarity and its size first, the figures after it in plain ink.
    const rarity = document.createElement('div');
    rarity.className = 'pal-rarity';
    const rarityName = document.createElement('span');
    rarityName.className = 'pal-rarity-name';
    const rarityGives = document.createElement('span');
    rarityGives.className = 'pal-rarity-gives';
    rarity.append(rarityName, rarityGives);
    card.append(head, rarity);

    const bar = (label: string, cls: string): { row: HTMLDivElement; fill: HTMLDivElement; value: HTMLSpanElement } => {
      const row = document.createElement('div');
      row.className = 'hud-bar-row';
      const l = document.createElement('span');
      l.className = 'hud-bar-label';
      l.textContent = label;
      const track = document.createElement('div');
      track.className = 'hud-bar';
      const fill = document.createElement('div');
      fill.className = `hud-bar-fill ${cls}`;
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'hud-bar-value';
      row.append(l, track, value);
      return { row, fill, value };
    };
    const health = bar('Health', 'bar-health');
    // Full is good, as on the status panel: the bar is how fed it is, and says so.
    const hunger = bar('Fed', 'bar-hunger');
    const care = bar('Care', 'bar-care');
    const pedigree = document.createElement('div');
    pedigree.className = 'pal-pedigree';
    const bloodBox = document.createElement('div');
    bloodBox.className = 'pal-traits';
    const worthBox = document.createElement('div');
    worthBox.className = 'pal-worth';
    // Its base stats, and what ancient pots have put into each (`baseStatTags`).
    const statBox = document.createElement('div');
    statBox.className = 'pal-worth pal-stats';
    const info = document.createElement('div');
    info.className = 'pal-info';
    // Why a worker is standing about (`idleSays`), and what it did this island day and the one before (`ledgerLines`).
    const idleLine = document.createElement('div');
    idleLine.className = 'pal-idle';
    const ledgerBox = document.createElement('div');
    ledgerBox.className = 'pal-ledger';
    card.append(health.row, hunger.row, care.row, statBox, pedigree, bloodBox, worthBox, info, idleLine, ledgerBox);
    // Its lifetime at work (`workLines`), which the island sends its keeper only.
    const workBox = document.createElement('div');
    workBox.className = 'pal-ledger pal-work';
    card.append(workBox);

    const set = (el: { textContent: string | null; title: string }, text: string, title: string): void => {
      if (el.textContent !== text) el.textContent = text;
      if (el.title !== title) el.title = title;
    };

    const refresh = (c: Creature): void => {
      cur = c;
      const def = SPECIES[c.species] ?? SPECIES.rabba;
      set(name, `${SEX_MARK[c.sex]} ${c.name}${c.name !== kindName(c) ? ` · ${kindName(c)}` : ''}`,
        `${SEX_NAMES[c.sex]} ${kindName(c).toLowerCase()}`);
      // "Rare · half again the size of its kind · +20% speed, …": the first two parts are what it is.
      const [what = '', size = '', ...gives] = rarityLine(c).split(' · ');
      const named = size ? `${what} · ${size}` : what;
      if (rarityName.textContent !== named) rarityName.textContent = named;
      const figures = gives.length ? ` · ${gives.join(' · ')}` : '';
      if (rarityGives.textContent !== figures) rarityGives.textContent = figures;
      rarity.hidden = !what;
      const hue = c.rare ? rarityOf(c).css : '';
      if (rarityName.style.color !== hue) rarityName.style.color = hue;
      // Age reads before anything else: a yearling cannot be worked at all.
      const age = ageOf(c, this.game.time);
      // Only the young are growing: what was walking about before the clock started is grown however the sum comes out.
      const growing = age === 'young' ? growsAt(c, this.game.time) : 0;
      set(level, `${age === 'grown' ? '' : `${age} · `}Lv ${creatureLevel(c)}`,
        growing > 0 ? `Grown in ${clockLeft(growing)}` : age === 'old' ? 'Old: slower, bigger carcass' : 'Grown');
      // Which one it is, not just that one of them is: the card is marked and
      // the reason is written beside the name.
      const wants: string[] = [];
      if (this.isHurt(c)) wants.push('hurt');
      if (this.isHungry(c)) wants.push('hungry');
      if (flags.dataset.says !== wants.join()) {
        flags.dataset.says = wants.join();
        flags.replaceChildren();
        for (const what of wants) {
          const tag = document.createElement('span');
          tag.className = `pal-flag pal-flag-${what}`;
          tag.textContent = what;
          tag.title = what === 'hurt' ? `Under ${Math.round(HURT_AT * 100)}% health.` : `Under ${Math.round(HUNGRY_AT * 100)}% fed.`;
          flags.append(tag);
        }
      }
      card.classList.toggle('pal-card-wants', wants.length > 0);

      const width = (fill: HTMLDivElement, v: number): void => {
        const w = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
        if (fill.style.width !== w) fill.style.width = w;
      };
      const top = maxHealth(c, def);
      width(health.fill, c.health / top);
      health.value.textContent = `${Math.ceil(c.health)}/${top}`;
      width(hunger.fill, c.hunger);
      hunger.value.textContent = `${Math.round(c.hunger * 100)}%`;
      // What a meal is putting on its learning now, and what its favourite would (`fedOn`).
      hunger.row.title = [wellFedSays(c, this.game.time), favouriteSays(def)].filter(Boolean).join(' \u00b7 ');
      width(care.fill, c.care);
      care.value.textContent = `${Math.round(c.care * 100)}%`;
      // What brushing is worth, said as the figure the rules read rather than
      // as “a quarter”, which was a number written in prose and never checked.
      care.row.title = `${careWord(c.care)} \u2014 work and learning \u00d7${careMul(c).toFixed(2)}, max \u00d7${(1 + CARE_BONUS).toFixed(2)} at full care; better young`;

      // Who it was bred from, over the traits it had from them, and how deep its
      // line runs on each channel it runs past one on (`lineLines`). Nothing at
      // all for anything that was not bred, or was born before pedigrees were kept.
      const bred = c.pedigree ? [pedigreeLine(c.pedigree), ...lineLines(c)].join('\n') : '';
      if (pedigree.textContent !== bred) pedigree.textContent = bred;
      pedigree.hidden = !bred;
      bloodBox.replaceChildren(...this.blood(c).childNodes);
      const w = this.worth(c);
      worthBox.replaceChildren(...(w ? [...w.childNodes] : []));
      worthBox.hidden = !w;
      const tags = [...baseStatTags(this.game, c), ...fittedTags(this.game, c), ...gearTags(c)];
      const statKey = tags.map((t) => t.text).join('|');
      if (statBox.dataset.says !== statKey) {
        statBox.dataset.says = statKey;
        const label = document.createElement('span');
        label.className = 'worth-label';
        label.textContent = 'Stats';
        label.title = 'Base stats now, ancient pot points included';
        statBox.replaceChildren(label, ...tags.map((t) => {
          const tag = document.createElement('span');
          tag.className = 'worth-tag';
          tag.textContent = t.text;
          tag.title = t.title;
          return tag;
        }));
      }

      const parts: string[] = [];
      // Its wild forms, and what each does (`formLabels`).
      parts.push(...formLabels(c, def));
      // Which vehicle, since a herd can be spread over more than one.
      const vehicle = this.game.vehicleOfCreature(c);
      const place = placeOf(c);
      if (place === 'saddle') parts.push('Ridden');
      else if (place === 'traces') parts.push(vehicle ? `In the traces of the ${furnitureDef(vehicle.kind).name.toLowerCase()}` : 'In the traces');
      else if (c.tacked) parts.push('Saddled and bridled');
      if (isShod(this.game.time, c)) parts.push(`Shod, ${Math.max(1, Math.ceil((SHOE_DAYS * DAY_SECONDS - (this.game.time - c.shodAt)) / DAY_SECONDS))} day${Math.ceil((SHOE_DAYS * DAY_SECONDS - (this.game.time - c.shodAt)) / DAY_SECONDS) === 1 ? '' : 's'} left`);
      if (c.due > 0) parts.push(`In young, due in ${clockLeft(Math.max(0, c.due - this.game.time))}`);
      // A stance and a round of work are for one that is following you or
      // working, not one in the traces or under a rider.
      if (place === 'active') parts.push(`Stance: ${STANCE_NAMES[c.stance]}`);
      if (place === 'deed') {
        const verb = def.gathers ? GATHER_VERB[def.gathers] : 'working';
        // Resting (`REST_FOR`) before anything it holds: a tired water carrier rests with its bucket.
        const rest = c.idle?.why === 'bed' ? 'Asleep in its bed' : c.idle?.why === 'rest' ? 'Resting' : c.idle?.why === 'tired' ? 'Walking to its bed' : '';
        parts.push(rest || (c.carrying ? `Carrying ${itemDef(c.carrying.id).name.toLowerCase()} to the crate` : c.state === 'forage' ? `${verb[0].toUpperCase()}${verb.slice(1)}` : c.state === 'toForage' ? `Walking out: ${def.gathers ?? 'work'}` : c.idle ? 'Idle' : 'Finding work'));
      }
      if (c.mode === 'deed' && def.gathers) {
        const toNext = SKILL_STEP - (taskSkill(c, def) % SKILL_STEP);
        parts.push(`Range ${workRangeOf(c, def)} tiles (+${def.rangePerStep ?? RANGE_PER_STEP} in ${toNext.toFixed(1)} skill)`);
      }
      // By the skill's own name, as the creature's note and your skills window say it, not its id.
      const skills = Object.entries(c.skills).map(([id, v]) => `${SKILL_BY_ID.get(id)?.name ?? id} ${v.toFixed(2)}`);
      parts.push(...skills);
      parts.push(`Experience ${c.xp.toFixed(1)}`);
      const said = parts.join(' · ');
      if (info.textContent !== said) info.textContent = said;
      const job = c.trade ?? def.gathers;
      const idle = place === 'deed' && c.idle ? idleSays(c.idle, job, c.carrying ? itemDef(c.carrying.id).name : null) : '';
      if (idleLine.textContent !== idle) idleLine.textContent = idle;
      idleLine.hidden = !idle;
      const ledger = c.mode === 'deed' ? ledgerLines(c.ledger, this.game.islandDay()).join('\n') : '';
      if (ledgerBox.textContent !== ledger) ledgerBox.textContent = ledger;
      ledgerBox.hidden = !ledger;
      const work = workLines(c.work, c.ledger);
      const worked = work.length ? ['Work', ...work].join('\n') : '';
      if (workBox.textContent !== worked) workBox.textContent = worked;
      workBox.hidden = !worked;
    };

    return { el: card, refresh };
  }

  /**
   * The three traits it was born with, with what each of them is worth.
   *
   * What you can read off an animal depends on the husbandry behind your eyes:
   * a common trait is plain to anybody, old blood takes a breeder to know. What
   * does *not* depend on anything is the figure beside a trait you can already
   * read — it was in `effects` from the day the trait was written and the card
   * printed the prose and threw the number away, which is what made a page of
   * real multipliers read as flair.
   *
   * And on anything bred, where each came from: the dam, the sire, both, a
   * fresh roll or bred up. Only on a trait you can read, by the same rule as
   * its name, since where an unread trait came from is a clue to what it is.
   */
  private blood(c: Creature): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'pal-traits';
    for (const id of c.traits) {
      const t = traitOf(id);
      if (!t) continue;
      const chip = document.createElement('span');
      chip.className = 'trait-chip';
      const known = readsTrait(this.game, id);
      if (known) {
        chip.textContent = t.aura ? `◉ ${t.name}` : t.name;
        chip.style.color = TIER_CSS[t.tier];
        chip.style.borderColor = TIER_CSS[t.tier];
        // The figures, beside the name rather than behind a hover: a trait you
        // have to point at to learn anything about is one you never read.
        for (const ch of CHANNELS) {
          const v = t.effects[ch.id];
          if (v === undefined) continue;
          const fig = document.createElement('span');
          fig.className = `trait-fig ${isGain(ch.id, v) ? 'trait-up' : 'trait-down'}`;
          fig.textContent = `${pct(v)} ${ch.label}`;
          chip.append(' ', fig);
        }
        const src = c.pedigree?.from?.[id];
        const came = src && Object.hasOwn(TRAIT_SOURCES, src) ? TRAIT_SOURCES[src] : undefined;
        if (came) {
          const from = document.createElement('span');
          from.className = 'trait-from';
          from.textContent = came.label;
          chip.append(' ', from);
        }
        const says = CHANNELS.filter((ch) => t.effects[ch.id] !== undefined)
          .map((ch) => `${pct(t.effects[ch.id] as number)} ${ch.label}: ${ch.note}`);
        if (came) says.push(`${came.label[0].toUpperCase()}${came.label.slice(1)}: ${came.means}.`);
        chip.title = `Rarity: ${t.tier}${t.aura ? ', communal: applies to every wildermon on the same settlement or post, itself included' : ''}`
          + `\n${says.join('\n')}`;
      } else {
        chip.textContent = 'something';
        chip.classList.add('trait-unread');
        chip.title = `Unread: needs ${traitReadNeeds(t.tier, this.game.skills.get('awareness'))} animal husbandry.`;
      }
      row.append(chip);
    }
    return row;
  }

  /**
   * What the three of them come to, after the herd and the brush.
   *
   * The chips say what each trait is worth on its own; this says what the
   * animal in front of you is worth, which is a different number and the one
   * every rule actually reads. Three traits multiply, a lead beast standing in
   * the same field multiplies again, and a well-brushed animal works and learns
   * a quarter faster — and the card had been claiming that last one in a
   * tooltip on the Care bar for as long as the bar has existed.
   *
   * Taken from `speedMul`, `workMul`, `learnMul` and `yieldMul` themselves
   * rather than worked out again here. A number written twice is a number that
   * drifts, and a card that works out its own answer is a card that can be
   * wrong about the rules while agreeing with itself.
   */
  private worth(c: Creature): HTMLDivElement | null {
    const beasts = this.game.creatures;
    const net = (ch: TraitChannel): number =>
      ch === 'speed' ? beasts.speedMul(c)
      : ch === 'work' ? beasts.workMul(c)
      : ch === 'learn' ? beasts.learnMul(c, this.game.time)
      : ch === 'yield' ? beasts.yieldMul(c)
      : bloodMul(c, ch);
    const row = document.createElement('div');
    row.className = 'pal-worth';
    const label = document.createElement('span');
    label.className = 'worth-label';
    label.textContent = 'In all';
    label.title = 'Traits multiplied together, with herd auras and care';
    row.append(label);
    let any = false;
    for (const ch of CHANNELS) {
      const v = net(ch.id);
      if (Math.abs(v - 1) < 0.005) continue;
      any = true;
      const tag = document.createElement('span');
      tag.className = `worth-tag ${isGain(ch.id, v) ? 'trait-up' : 'trait-down'}`;
      tag.textContent = `${pct(v)} ${ch.label}`;
      // Where it came from, so a figure that moved has somewhere to have moved from.
      const parts = [`${ch.note}.`, `Blood ${traitMul(c.traits, ch.id).toFixed(2)}×`];
      const line = lineMul(c.traits, c.pedigree?.line, ch.id);
      if (Math.abs(line - 1) >= 0.005) parts.push(`line ${line.toFixed(2)}×`);
      if (c.rare) parts.push(`${rarityOf(c).name} ${rarityMul(c, ch.id).toFixed(2)}×`);
      if (Math.abs(potMul(c, ch.id) - 1) >= 0.005) parts.push(`ancient pots ${potMul(c, ch.id).toFixed(2)}×`);
      const herd = beasts.aura(c, ch.id);
      if (Math.abs(herd - 1) >= 0.005) parts.push(`herd ${herd.toFixed(2)}×`);
      if ((ch.id === 'work' || ch.id === 'learn') && c.care > 0) parts.push(`brushing ${careMul(c).toFixed(2)}×`);
      const fed = ch.id === 'learn' ? fedNow(c, this.game.time) : 0;
      if (fed > 0) parts.push(`well fed ${(1 + fed).toFixed(2)}×`);
      tag.title = parts.join(' · ');
      row.append(tag);
    }
    return any ? row : null;
  }
}
