import { STORE_REACH } from '../../game/crates';
import { putAway } from '../../game/putaway';
import { isArrow } from '../../game/fight';
import { CARRY_STOP, type Game } from '../../game/game';
import { itemDef, itemName, type Item, type ItemCategory, itemWeight, bagRoom, bagUnits, isBag, RARITIES } from '../../game/items';
import { damageCell, headRow, nameCell, qualityCell } from '../itemcells';
import { occupantOf } from '../../game/creaturecrate';
import type { ContextMenu, MenuItem } from '../contextmenu';
import { makeDraggable, makeDropZone, type DragPayload } from '../dragdrop';
import { Picking } from '../picking';
import type { UIWindow } from '../windows';
import { COUNTS, pinEntry, pinnable } from '../beltmenu';
import { orderBy, sortSelect, type SortKey } from '../sorting';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../game/actions';
import { ABSORB_SAID, absorbable, SOUL } from '../../game/sacrifice';
import { ENCHANT, enchantable, fitsOn } from '../../game/enchanting';
import { ENCHANT_SAID, enchantChance, ENCHANTERS_PLINTH, ENCHANTING, scrollOf, wrongKind } from '../../game/enchant';
import { percent } from '../../game/words';
import { hasRunestones, RUNESTONES, stoneChoice, stoneDistance, TELESTONE, TELESTONE_SAID, telestoneRange, telestoneWait, timeLeftNote, TRAVEL } from '../../game/runestones';
import { improvable, improveCeiling } from '../../game/improve';

const CATEGORY_ORDER: Array<[ItemCategory, string]> = [
  ['tool', 'Tools'],
  ['material', 'Materials'],
  ['food', 'Food'],
  ['plant', 'Plants & seeds'],
  ['misc', 'Other'],
];

export class InventoryPanel {
  private list: HTMLDivElement;
  private footer: HTMLDivElement;
  private search: HTMLInputElement;
  private query = '';
  private selected: number | null = null;
  private sort: SortKey = 'name';
  private grouped = true;
  private load: HTMLDivElement;
  private loadFill: HTMLDivElement;
  /** Several things picked at once with Ctrl- and Shift-click (`Picking`), and the bar that moves them. */
  private readonly picking = new Picking();
  private pickBar: HTMLDivElement;
  /** The rows' uids in the order they are drawn, for a Shift-click's run. */
  private order: number[] = [];

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly menu: ContextMenu,
    private readonly dropped?: (p: DragPayload) => void,
    /** Opens a carried bag in the store window. */
    private readonly openBag?: (uid: number) => void,
    /** Opens a treasure map's picture. */
    private readonly readMap?: (uid: number) => void,
    /** The spells on the bar that can be cast on a thing, as rows for its menu. */
    private readonly spellsFor?: (uid: number) => MenuItem[],
    /** What the open store offers a thing from the pack: "Put every … in the crate". */
    private readonly storeEntries?: (item: Item) => MenuItem[],
    /** A card for what is under the pointer: a weapon or armour set against what you have on (`compareLines`). */
    private readonly hover?: (item: Item | null, x: number, y: number) => void,
    /** Where the picked things can go in one press: the open store, by its name, or null when none is open and in reach. */
    private readonly pickedTo?: () => { where: string; go: (uids: number[]) => void } | null,
  ) {
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search';
    this.search.placeholder = 'Search your pack…';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.render();
    });
    // Escape clears the box rather than closing the window out from under you.
    this.search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      this.search.value = '';
      this.query = '';
      this.render();
    });
    // How the list is put in order, and whether it is grouped by kind.
    const bar = document.createElement('div');
    bar.className = 'panel-bar';
    const sortSel = sortSelect('How to order the list', (key) => {
      this.sort = key;
      this.render();
    });
    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.className = 'tb-btn tb-small';
    groupBtn.textContent = 'Grouped';
    groupBtn.title = 'Group by kind, or run everything together in one list';
    groupBtn.setAttribute('aria-pressed', 'true');
    groupBtn.addEventListener('click', () => {
      this.grouped = !this.grouped;
      groupBtn.textContent = this.grouped ? 'Grouped' : 'Flat';
      groupBtn.classList.toggle('tb-on', this.grouped);
      groupBtn.setAttribute('aria-pressed', String(this.grouped));
      this.render();
    });
    groupBtn.classList.add('tb-on');
    // Every loose stack into a store within reach that already holds the like of it (`putaway.ts`).
    const awayBtn = document.createElement('button');
    awayBtn.type = 'button';
    awayBtn.className = 'tb-btn tb-small';
    awayBtn.textContent = 'Put away';
    awayBtn.title = `Put each stack into a crate, chest or cart within ${STORE_REACH} tiles that already holds the same thing`;
    awayBtn.addEventListener('click', () => putAway(this.game));
    bar.append(sortSel, groupBtn, awayBtn);
    const head = headRow({ label: 'Wt', className: 'inv-wt', title: 'Weight of the whole stack, in kg' });
    this.list = document.createElement('div');
    this.list.className = 'inv-list';
    this.footer = document.createElement('div');
    this.footer.className = 'inv-footer';
    /*
     * What you carry, as a bar: the mark is where the load starts to slow you
     * (`carryLimit`), the end is half again past it (`CARRY_STOP`), where you
     * are down to a crawl. Asked for so the slowdown is seen coming rather
     * than found by walking into it.
     */
    this.load = document.createElement('div');
    this.load.className = 'inv-load';
    this.loadFill = document.createElement('div');
    this.loadFill.className = 'inv-load-fill';
    const mark = document.createElement('div');
    mark.className = 'inv-load-mark';
    mark.style.left = `${(100 / CARRY_STOP).toFixed(2)}%`;
    this.load.append(this.loadFill, mark);
    this.pickBar = document.createElement('div');
    this.pickBar.className = 'pick-bar';
    this.pickBar.hidden = true;
    win.body.append(this.search, bar, head, this.list, this.pickBar, this.load, this.footer);
    win.body.classList.add('inv-body', 'items-body', 'pack-body');
    makeDropZone(
      this.list,
      (p) => p.from === 'store',
      (p) => this.dropped?.(p),
    );
    game.events.on('inventory', () => this.render());
    this.render();
  }

  /** Whether an item answers to what has been typed in the search box. */
  private matches(item: Item): boolean {
    if (!this.query) return true;
    const def = itemDef(item.id);
    return `${itemName(item)} ${def.category} ${def.description ?? ''}`.toLowerCase().includes(this.query);
  }

  /** The order the list is asked for, which a store window now asks the same way. */
  private ordered(items: Item[]): Item[] {
    return orderBy(items, this.sort);
  }

  render(): void {
    const items = this.game.inventory.items;
    const shown = items.filter((it) => this.matches(it));
    this.picking.keep(new Set(shown.map((it) => it.uid)));
    this.order = [];
    this.list.replaceChildren();
    if (!this.grouped) {
      for (const item of this.ordered(shown)) this.list.append(this.row(item));
    } else
    for (const [cat, label] of CATEGORY_ORDER) {
      const group = shown.filter((it) => itemDef(it.id).category === cat);
      if (!group.length) continue;
      const header = document.createElement('div');
      header.className = 'inv-group';
      header.textContent = label;
      this.list.append(header);
      for (const item of this.ordered(group)) this.list.append(this.row(item));
    }
    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = items.length
        ? `Nothing you are carrying answers to “${this.search.value.trim()}”. Press Escape in the box to clear it.`
        : 'Your pack is empty. What you pick up, make, or take out of a store comes here.';
      this.list.append(empty);
    }
    this.drawPickBar();
    const weight = this.game.inventory.totalWeight();
    const limit = this.game.carryLimit();
    const over = this.game.overloaded();
    // Half again over the limit is where the drag becomes a wall — one you can
    // still creep along, at `CARRY_CRAWL` — so the line says which of the two
    // you are in rather than only that you are over.
    const stuck = this.game.stalled();
    const stop = limit * CARRY_STOP;
    const all = `${items.reduce((n, it) => n + it.count, 0)} items · ${weight.toFixed(1)} / ${limit.toFixed(0)} kg${stuck ? ' · too heavy to walk properly' : ''}`;
    this.footer.textContent = this.query ? `${shown.reduce((n, it) => n + it.count, 0)} of ${all}` : all;
    this.footer.classList.toggle('inv-over', over > 0);
    this.footer.classList.toggle('inv-stuck', stuck);
    this.loadFill.style.width = `${Math.min(100, (weight / Math.max(0.001, stop)) * 100).toFixed(1)}%`;
    this.load.classList.toggle('inv-over', over > 0);
    this.load.classList.toggle('inv-stuck', stuck);
    this.load.title = `${weight.toFixed(1)} kg of ${stop.toFixed(0)}. The mark is ${limit.toFixed(0)} kg, where the load starts to slow you and tire you faster; at the end, ${stop.toFixed(0)} kg, you are down to a twentieth of your pace.`;
    this.footer.title = stuck
      ? `${weight.toFixed(1)} kg on a back that takes ${limit.toFixed(0)}. Over ${stop.toFixed(0)} kg you are down to a twentieth of your pace: put ${(weight - stop).toFixed(1)} kg down, or into a cart or a crate.`
      : over > 0
        ? `${over.toFixed(1)} kg past what your back will take. You are slower and you tire faster; over ${stop.toFixed(0)} kg you are down to a crawl.`
        : `${(limit - weight).toFixed(1)} kg to spare.`;
  }

  /** "3 picked", and the press that moves them all, when more than none are picked. */
  private drawPickBar(): void {
    const n = this.picking.size;
    this.pickBar.hidden = n === 0;
    if (!n) return;
    const say = document.createElement('span');
    say.textContent = `${n} picked`;
    say.title = 'Ctrl-click a row to add it or take it off, Shift-click for every row from the last one picked. Drag any picked row to move them all.';
    const parts: HTMLElement[] = [say];
    const to = this.pickedTo?.();
    if (to) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'tb-btn tb-small';
      go.textContent = `Put in the ${to.where}`;
      go.title = `Every picked stack, whole, into the ${to.where}`;
      go.addEventListener('click', () => {
        to.go([...this.picking.uids]);
        this.picking.clear();
        this.render();
      });
      parts.push(go);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tb-btn tb-small';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      this.picking.clear();
      this.render();
    });
    parts.push(clear);
    this.pickBar.replaceChildren(...parts);
  }

  private row(item: Item): HTMLDivElement {
    const row = document.createElement('div');
    this.order.push(item.uid);
    row.className = 'inv-row' + (item.uid === this.selected ? ' selected' : '') + (this.picking.uids.has(item.uid) ? ' picked' : '');
    const name = nameCell(item, { worn: this.game.isEquipped(item.uid), occupant: occupantOf(this.game, item) });
    const ql = qualityCell(this.game, item);
    const dmg = damageCell(item);
    const wt = document.createElement('span');
    wt.className = 'inv-wt';
    wt.textContent = itemWeight(item).toFixed(1);
    row.append(name, ql, dmg, wt);
    const open = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      this.selected = item.uid;
      this.render();
      this.openMenu(item, e.clientX, e.clientY);
    };
    row.addEventListener('click', (e) => {
      if (this.picking.click(item.uid, this.order, e)) {
        e.preventDefault();
        e.stopPropagation();
        this.render();
        return;
      }
      open(e);
    });
    row.addEventListener('contextmenu', open);
    if (this.hover) {
      row.addEventListener('mousemove', (e) => this.hover?.(item, e.clientX, e.clientY));
      row.addEventListener('mouseleave', () => this.hover?.(null, 0, 0));
    }
    makeDraggable(row, () => ({ uid: item.uid, from: 'inventory', name: itemName(item), uids: this.picking.carried(item.uid) }));
    return row;
  }

  /**
   * "Take it to sixty."
   *
   * A count of passes is the wrong unit for improving and always was. What a
   * pass is worth falls away as the piece gets better — forty to forty-one is
   * one pass and ninety to ninety-one is a dozen — so asking for fifty is
   * asking for a number nobody can work out in advance, and the answer is
   * always either short or wasted.
   *
   * A quality is the unit people actually think in, and it costs nothing to
   * offer: improving repeats until its own check refuses it, so a ceiling in
   * the target is the whole feature. The island reads the same field off the
   * same target and refuses in the same words.
   *
   * Only the rungs above where the piece already is are worth showing, and
   * only up to what the hands could manage, because a ceiling your skill
   * cannot reach is a job that stops early and says something else.
   */
  private upToEntry(item: Item, def: ActionDef): MenuItem {
    const rungs = [20, 40, 60, 70, 80, 90, 95];
    const reach = improveCeiling(this.game, improvable(item.id)?.skill ?? '', item);
    const worth = rungs.filter((q) => q > item.ql + 0.05);
    if (!worth.length) return { label: 'Up to…', hint: 'It is past every mark worth aiming at.', disabled: true };
    return {
      label: 'Up to…',
      note: `it is at QL ${item.ql.toFixed(1)}`,
      children: worth.map((q) => ({
        label: `Quality ${q}`,
        note: q > reach ? `your hands top out at ${reach.toFixed(0)}, so it will stop there` : undefined,
        onSelect: () => this.game.requestAction(def, { kind: 'item', uid: item.uid, upto: q }),
      })),
    };
  }

  /** Action menu for an item; stack actions get a one / all submenu. */
  private openMenu(item: Item, x: number, y: number): void {
    const target = { kind: 'item' as const, uid: item.uid };
    const entries: MenuItem[] = [];
    // A bag is opened rather than used, so that entry comes first.
    if (isBag(item)) entries.push({ label: 'Open', note: `${bagUnits(item)} / ${bagRoom(item)} things`, onSelect: () => this.openBag?.(item.uid) });
    /*
     * And a map is read rather than used. First, for the same reason: the
     * whole of what a map is for is looking at it, and "Dig it up" is a thing
     * you do once, at the end, somewhere else entirely.
     */
    if (item.id === 'treasure_map') entries.push({ label: 'Read', note: 'Look at the country on it', onSelect: () => this.readMap?.(item.uid) });
    // A soul goes into something else, which is chosen here.
    const absorb = item.id === SOUL ? ACTION_BY_ID.get('absorb_soul') : undefined;
    if (absorb) {
      const into = absorbable(this.game);
      entries.push({
        label: 'Absorb into',
        note: `makes one ordinary thing ${RARITIES[item.rare ?? 0].name}`,
        hint: into.length ? undefined : ABSORB_SAID.pickItem,
        disabled: !into.length,
        children: into.map((it) => {
          const t = { kind: 'item' as const, uid: it.uid, soul: item.uid };
          const why = absorb.check?.(t, this.game) ?? null;
          return { label: itemName(it), note: it.count > 1 ? `one of ${it.count}` : undefined, hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(absorb, t) };
        }),
      });
    }
    /*
     * And a scroll goes into what it goes on, which is chosen here, with the
     * chance it takes at your enchanting and the scroll's QL (`enchant.ts`).
     */
    const written = scrollOf(item.id);
    const enchant = written ? ACTION_BY_ID.get(ENCHANT) : undefined;
    if (enchant && written) {
      const into = enchantable(this.game, written);
      // And what stands within reach that it goes on, enchanted where it stands (`Game.placedNear`).
      const standing = this.game.placedNear().filter(({ placed }) => fitsOn(written.on, placed.def));
      // Done standing at an enchanter's plinth and nowhere else, which is said here before anything is chosen.
      const away = this.game.atStation(ENCHANTERS_PLINTH) ? undefined : ENCHANT_SAID.plinth;
      entries.push({
        label: 'Enchant',
        note: `takes ${percent(enchantChance(this.game.skills.get(ENCHANTING), item.ql))} of the time`,
        hint: away ?? (into.length || standing.length ? undefined : wrongKind(written)),
        disabled: !!away || (!into.length && !standing.length),
        children: [
          ...into.map((it) => {
            const t = { kind: 'item' as const, uid: it.uid, scroll: item.uid };
            const why = enchant.check?.(t, this.game) ?? null;
            return { label: itemName(it), note: `QL ${it.ql.toFixed(1)}`, hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(enchant, t) };
          }),
          ...standing.map(({ target, placed }) => {
            const t = { ...target, scroll: item.uid } as Target;
            const why = enchant.check?.(t, this.game) ?? null;
            return { label: placed.name, note: `QL ${placed.thing.ql.toFixed(1)}, standing`, hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(enchant, t) };
          }),
        ],
      });
    }
    /*
     * A Telestone takes you to a Runestone, chosen here: those within its
     * reach of where you stand by name and distance, and the rest shown out of
     * reach. The wait after a journey is said on the entry while it lasts.
     */
    const travel = item.id === TELESTONE ? ACTION_BY_ID.get(TRAVEL) : undefined;
    if (travel && !hasRunestones(this.game.world.w)) {
      entries.push({ label: travel.label, hint: TELESTONE_SAID.nowhere, disabled: true });
    } else if (travel) {
      const reach = telestoneRange(item.ql);
      const wait = telestoneWait(this.game);
      entries.push({
        label: travel.label,
        note: wait > 0 ? timeLeftNote(wait) : `reaches ${Math.floor(reach + 0.5)} tiles`,
        children: RUNESTONES.map((s) => ({ s, d: stoneDistance(this.game, s) })).sort((a, b) => a.d - b.d).map(({ s, d }) => {
          const t = { kind: 'item' as const, uid: item.uid, stone: s.id };
          const why = travel.check?.(t, this.game) ?? null;
          return { label: stoneChoice(s, d), hint: why ?? undefined, disabled: d > reach, onSelect: () => this.game.requestAction(travel, t) };
        }),
      });
    }
    // Arrows: which kind a bow looses first while there are any (`nockedArrow`).
    if (isArrow(item.id)) {
      const first = this.game.settings.nock === item.id;
      entries.push({
        label: first ? 'Shot first (now)' : 'Shoot these first',
        note: first ? 'a bow looses these while there are any' : undefined,
        disabled: first,
        onSelect: () => {
          this.game.settings.nock = item.id;
          this.game.logMsg(`A bow looses ${itemName(item).toLowerCase()} first now, while you have any.`, 'info');
        },
      });
    }
    entries.push(...this.game.actionsFor(target).map(({ def, reason }) => {
      const all = def.maxRepeat ? def.maxRepeat(target, this.game) : item.count;
      if (def.quantity && all > 1 && !reason) {
        return {
          label: def.label,
          children: [
            { label: 'One', onSelect: () => this.game.requestAction(def, { ...target, count: 1 }) },
            { label: `All (${all})`, onSelect: () => this.game.requestAction(def, { ...target, count: all }) },
          ],
        };
      }
      if (def.repeat && !reason) {
        return {
          label: def.label,
          children: [
            { label: 'Once', onSelect: () => this.game.requestAction(def, target, 1) },
            ...COUNTS.map((n) => ({ label: `${n} times`, onSelect: () => this.game.requestAction(def, target, n) })),
            ...(def.id === 'improve_item' ? [this.upToEntry(item, def)] : []),
          ],
        };
      }
      return { label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => this.game.requestAction(def, target) };
    }));
    // Hanging one of this thing's jobs on the belt. The loop remembers the kind
    // of thing, not this one, so it still works on the next loaf you bake.
    const hangable = this.game.actionsFor(target).filter((a) => pinnable(a.def));
    if (hangable.length && this.game.beltLoops()) {
      entries.push({
        label: 'Hang a job on your belt',
        children: hangable.map(({ def }) => ({ label: def.label, children: pinEntry(this.game, { action: def.id, item: item.id }).children })),
      });
    }
    this.win.focus();
    entries.push(...(this.storeEntries?.(item) ?? []));
    entries.push(...(this.spellsFor?.(item.uid) ?? []));
    this.menu.show(x, y, itemName(item), entries);
  }
}
