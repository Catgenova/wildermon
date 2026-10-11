import { ACTION_BY_ID } from '../../game/actions';
import type { Game } from '../../game/game';
import { itemDef } from '../../game/items';
import { CRAFT_REACH, DEED_ONLY, RECIPE_BY_ID, RECIPE_CATEGORIES, RECIPES, materialChoices, prospect, reachFor, recipeReason, recipeStatus, stationName, type CraftStock, type Recipe, type RecipeStatus } from '../../game/recipes';
import { isFurniture, ONE_ALTAR } from '../../game/furniture';
import { SKILL_DEFS } from '../../game/skills';
import type { UIWindow } from '../windows';
import { Repaint } from '../repaint';

const skillName = (id: string): string => SKILL_DEFS.find((s) => s.id === id)?.name ?? id;
const lower = (id: string): string => itemDef(id).name.toLowerCase();

/** Where the pinned and the lately made are kept: in this browser, like the window layout, since they are about whoever sits here. */
const KEPT_KEY = 'wurm-iso-recipes';
/** How many of the lately made are shown above the book. */
export const RECENT = 6;
/** Every recipe that makes a thing, by the thing. */
const MAKES = new Map<string, Recipe[]>();
for (const r of RECIPES) MAKES.set(r.result, [...(MAKES.get(r.result) ?? []), r]);
/** The recipes that make an item, if any do. */
export const recipesMaking = (item: string): Recipe[] => MAKES.get(item) ?? [];

interface Kept {
  pinned: string[];
  recent: string[];
}

function readKept(): Kept {
  try {
    const got = JSON.parse(localStorage.getItem(KEPT_KEY) ?? '{}') as Partial<Kept>;
    const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && RECIPE_BY_ID.has(x)) : []);
    return { pinned: ids(got.pinned), recent: ids(got.recent).slice(0, RECENT) };
  } catch {
    return { pinned: [], recent: [] };
  }
}

/**
 * The recipe book, grouped by craft. Every recipe is listed with its tool and
 * materials marked green when at hand and red when missing, and the ones that
 * can be made right now come first. A switch narrows it to just those.
 *
 * At hand is what a craft may spend: the pack, the bags on your back, and the
 * stores within `CRAFT_REACH` tiles that are yours and open for you. So the
 * book is looked at again when a store's contents change and when you step
 * onto another tile, since either can change what it would say.
 */
export class CraftPanel {
  private readonly repaint = new Repaint(250);
  private list: HTMLDivElement;
  private footer: HTMLDivElement;
  private hint: HTMLSpanElement;
  private search: HTMLInputElement;
  private query = '';
  private readyOnly = false;
  /** What each recipe is to be made of, where the row was set to a wood or a metal: recipe id to material. */
  private readonly wants = new Map<string, string>();
  /** The tile you were on when the book last looked, since a step can bring a store into reach or take one out of it. */
  private tile = '';
  private readyBox: HTMLInputElement;
  /** Pinned and lately made, shown in their own groups above the book. */
  private kept: Kept = readKept();
  /** Only these recipes, when the book was opened onto what makes one thing (`showMaking`); cleared by typing. */
  private only: Set<string> | null = null;
  /** The recipe to bring into view and light up on the next draw. */
  private reveal: string | null = null;
  /** The last job asked for that the book has already counted as made, so one job is one entry. */
  private counted: unknown = null;
  /** Told when a missing material is clicked that no recipe makes: the help is asked instead. */
  onNoRecipe: ((item: string) => void) | null = null;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('inv-body');
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search';
    this.search.placeholder = 'Search recipes: a thing, a skill, a material…';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.only = null;
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      this.search.value = '';
      this.query = '';
      this.only = null;
      this.render();
    });
    const head = document.createElement('div');
    head.className = 'craft-head';
    const hint = document.createElement('span');
    hint.textContent = 'Tool, place and materials each recipe needs';
    this.hint = hint;
    const toggle = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'craft-ready-only';
    this.readyBox = box;
    box.addEventListener('change', () => {
      this.readyOnly = box.checked;
      this.render();
    });
    toggle.append(box, document.createTextNode('Only what I can make'));
    head.append(hint, toggle);
    this.list = document.createElement('div');
    this.list.className = 'inv-list';
    this.footer = document.createElement('div');
    this.footer.className = 'inv-footer';
    win.body.append(this.search, head, this.list, this.footer);
    // Every action gains a skill, so this fires several times a second while
    // you work. The book is looked at on a beat and redrawn only when what it
    // would say has actually changed.
    game.events.on('inventory', () => this.repaint.ask());
    game.events.on('skill', () => this.repaint.ask());
    // What is in the crates and chests around you counts too.
    game.events.on('crate', () => this.repaint.ask());
    /*
     * What was made lately, however it was asked for: this window, a menu, the
     * toolbelt or the key that does it again. Every one of them goes through
     * `requestAction`, which keeps what it was last asked.
     */
    game.events.on('action', () => {
      const asked = game.lastAsked;
      if (!asked || asked === this.counted) return;
      this.counted = asked;
      if (RECIPE_BY_ID.has(asked.def.id)) this.made(asked.def.id);
    });
    this.render();
  }

  private putKept(): void {
    try {
      localStorage.setItem(KEPT_KEY, JSON.stringify(this.kept));
    } catch {
      // Kept for as long as the page is open.
    }
  }

  /** Put a recipe at the head of the lately made. */
  private made(id: string): void {
    this.kept.recent = [id, ...this.kept.recent.filter((r) => r !== id)].slice(0, RECENT);
    this.putKept();
    this.repaint.ask();
  }

  private togglePin(id: string): void {
    const on = this.kept.pinned.includes(id);
    this.kept.pinned = on ? this.kept.pinned.filter((r) => r !== id) : [...this.kept.pinned, id];
    this.putKept();
    this.render(performance.now(), true);
  }

  /** Clear the search and the switch, so whatever is asked for next is on the page. */
  private unfilter(): void {
    this.search.value = '';
    this.query = '';
    this.only = null;
    this.readyOnly = false;
    this.readyBox.checked = false;
  }

  /** Open the book at one recipe, lit up. */
  showRecipe(id: string): void {
    if (!RECIPE_BY_ID.has(id)) return;
    this.unfilter();
    this.reveal = id;
    this.win.open();
    this.render(performance.now(), true);
  }

  /**
   * Open the book at whatever makes a thing, and only that: what a missing
   * material on a row leads to when it is clicked. False when nothing does,
   * for the caller to say where it comes from instead.
   */
  showMaking(item: string): boolean {
    const makes = recipesMaking(item);
    if (!makes.length) return false;
    this.unfilter();
    this.only = new Set(makes.map((r) => r.id));
    this.search.value = itemDef(item).name;
    this.reveal = makes[0].id;
    this.win.open();
    this.render(performance.now(), true);
    return true;
  }

  /**
   * Whether a recipe answers to what has been typed. Everything on the row is
   * searchable: what it makes, the trade it takes, where it is worked, what
   * goes into it and the line under the name, so "leather", "mason", "nail"
   * and "big axle" all find their own -- the last of those being a mould,
   * which is the only way to an axle and was findable under no other word.
   */
  private matches(r: Recipe): boolean {
    if (!this.query) return true;
    const parts = [itemDef(r.result).name, r.label, r.note ?? '', r.category, skillName(r.skill), r.tool ? lower(r.tool) : '', r.station ? stationName(r.station) : '', r.deed ? 'settlement deed' : '', ...r.inputs.map((i) => lower(i.item))];
    return parts.join(' ').toLowerCase().includes(this.query);
  }

  /** Look again, on a beat, and redraw only if the book has changed. */
  update(now: number): void {
    if (!this.win.isOpen) return;
    const tile = `${this.game.player.tileX},${this.game.player.tileY}`;
    if (tile !== this.tile) {
      this.tile = tile;
      this.repaint.ask();
    }
    if (!this.repaint.due(now)) return;
    this.render(now);
  }

  render(now = performance.now(), force = false): void {
    // What is at hand, listed once for each reach the book asks for rather
    // than once a row: three tiles, or further for a Smith's Forge Reach at
    // the smelter and a Cook's Pantry Reach at the fire (`reachFor`).
    const byReach = new Map<number, readonly CraftStock[]>();
    const stockOf = (r: Recipe): readonly CraftStock[] => {
      const reach = reachFor(this.game, r);
      let found = byReach.get(reach);
      if (!found) byReach.set(reach, (found = reach > CRAFT_REACH ? this.game.craftStock(undefined, false, reach) : this.game.craftStock()));
      return found;
    };
    const statuses = new Map<Recipe, RecipeStatus>(RECIPES.map((r) => [r, recipeStatus(r, this.game, this.wants.get(r.id), stockOf(r))]));
    // What the book would say. Standing at an anvil hammering, this is the
    // same from one second to the next, so nothing is touched.
    const { fromStores, spareRare } = this.game.settings;
    const sig = `${this.query}\u0000${this.only ? [...this.only].join() : ''}\u0000${this.kept.pinned.join()}\u0000${this.kept.recent.join()}\u0000${this.readyOnly ? 1 : 0}${fromStores ? 1 : 0}${spareRare ? 1 : 0}\u0000${RECIPES.map((r) => {
      const st = statuses.get(r);
      return `${r.id}${st?.ready ? 1 : 0}${st?.max ?? 0}${st?.inputs.map((i) => `.${i.have}.${i.carried}`).join('') ?? ''}`;
    }).join('')}`;
    if (!this.repaint.changed(now, sig) && !force) return;
    // What the counts count, which Settings decides.
    const atHand = fromStores ? `what you carry and what is in your stores within ${CRAFT_REACH} tiles` : 'what you carry';
    this.hint.title = `Materials count ${fromStores
      ? `what you carry, in your pack and your bags, and what is in your stores within ${CRAFT_REACH} tiles. The pack is used first, then the bags, then the nearest store.`
      : 'what you carry, in your pack and your bags: Settings keeps your stores out. The pack is used first, then the bags.'}${spareRare
      ? ' Rare stock is left out of the counts, as Settings asks; right-click a rare stack to make something from it.'
      : ''}`;
    this.list.replaceChildren();
    let shown = 0;
    let ready = 0;
    const wanted = (r: Recipe): boolean => (this.only ? this.only.has(r.id) : this.matches(r)) && (!this.readyOnly || !!statuses.get(r)?.ready);
    /*
     * Pinned, and lately made, above the book and in the order they were
     * pinned or made: the few things somebody makes over and over, without
     * scrolling a hundred and fifty recipes to find them. They are in the book
     * below as well, under their craft. Not while the book is opened onto one
     * thing, which is a question with one answer.
     */
    if (!this.only) {
      for (const [title, ids] of [['Pinned', this.kept.pinned], ['Made lately', this.kept.recent.filter((id) => !this.kept.pinned.includes(id))]] as Array<[string, string[]]>) {
        const rows = ids.map((id) => RECIPE_BY_ID.get(id)).filter((r): r is Recipe => !!r && wanted(r));
        if (!rows.length) continue;
        const header = document.createElement('div');
        header.className = 'inv-group craft-kept';
        header.textContent = title;
        this.list.append(header);
        for (const r of rows) this.list.append(this.row(r, statuses.get(r)!, stockOf(r)));
      }
    }
    for (const cat of RECIPE_CATEGORIES) {
      const rows = RECIPES.filter((r) => r.category === cat && wanted(r));
      // What can be made now sits above what still needs gathering.
      rows.sort((a, b) => Number(statuses.get(b)?.ready ?? false) - Number(statuses.get(a)?.ready ?? false));
      if (!rows.length) continue;
      const header = document.createElement('div');
      header.className = 'inv-group';
      header.textContent = cat;
      this.list.append(header);
      for (const r of rows) {
        const st = statuses.get(r)!;
        this.list.append(this.row(r, st, stockOf(r)));
        shown++;
        if (st.ready) ready++;
      }
    }
    if (!shown) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = this.query || this.only
        ? `No recipe answers to “${this.search.value.trim()}”${this.readyOnly ? ' that you can make right now' : ''}.`
        : `Nothing can be made with ${atHand}. Untick "Only what I can make" to see what each thing needs.`;
      this.list.append(empty);
    }
    const within = `with ${atHand}`;
    this.footer.textContent = this.only
      ? `${shown === 1 ? 'One recipe makes' : `${shown} recipes make`} this, ${ready} of them possible ${within}`
      : this.query
        ? `${shown} recipes match, ${ready} of them possible ${within}`
        : `${ready} of ${RECIPES.length} recipes possible ${within}`;
    // Opened onto one recipe: the last row of it drawn (the one in the book, under its craft) is brought into view and lit.
    if (this.reveal) {
      const rows = this.list.querySelectorAll<HTMLElement>(`.craft-row[data-recipe="${this.reveal}"]`);
      const row = rows[rows.length - 1];
      this.reveal = null;
      if (row) {
        row.scrollIntoView({ block: 'center' });
        row.classList.remove('found-flash');
        void row.offsetWidth;
        row.classList.add('found-flash');
      }
    }
  }

  private row(r: Recipe, st: RecipeStatus, stock: readonly CraftStock[]): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'craft-row' + (st.ready ? '' : ' locked');
    row.dataset.recipe = r.id;
    const name = document.createElement('div');
    name.className = 'craft-name';
    const count = this.game.madeAGo(r);
    name.textContent = count > 1 ? `${itemDef(r.result).name} × ${count}` : itemDef(r.result).name;
    const meta = document.createElement('small');
    meta.textContent = `${skillName(r.skill)} · ${this.game.duration(ACTION_BY_ID.get(r.id)!).toFixed(0)} s`;
    name.append(meta);
    /*
     * What it would come out at, which nothing anywhere has ever said.
     *
     * Your skill is the ceiling and your tool decides how often you reach it,
     * and both halves of that were findable only by making forty of something
     * and noticing. It was reported as the game being broken — "i've made a
     * lot of whetstones and haven't managed anything other than QL 1" — which
     * is what the rule looks like from outside when nobody has said it.
     */
    const pr = prospect(r, this.game, stock);
    const worth = document.createElement('small');
    worth.className = 'craft-ql' + (pr.toolBound ? ' craft-ql-held' : '');
    /*
     * Two different sentences, because there are two different rules. A thing
     * made out of its own parts is not rolled for: it is worth what its parts
     * are worth, less the share the work loses, so the line names that number
     * and not the skill. Everything else is a roll against the hands, with the
     * tool deciding how often a go reaches them.
     */
    worth.textContent = pr.fromInputs
      ? pr.partsInHand
        ? `QL ${pr.ceiling.toFixed(0)}, out of the parts at hand`
        : `${Math.round(pr.keep * 100)}% of what the parts are worth`
      : !pr.tooled
        ? `up to QL ${pr.ceiling.toFixed(0)}`
        : pr.reach >= 0.9
          ? `QL ${pr.ceiling.toFixed(0)}, near enough every time`
          : `up to QL ${pr.ceiling.toFixed(0)}, about ${Math.round(pr.reach * 100)}% of goes; the rest near QL ${pr.short.toFixed(0)}`;
    worth.title = pr.fromInputs
      ? `The parts decide this, not a roll: what goes in, weighed by how much of each of it goes in, and your ${r.skill.replace(/_/g, ' ')} keeps ${Math.round(pr.keep * 100)}% of it. A better part is the only way to a better one.`
      : pr.toolBound
        ? `Your ${lower(r.tool as string)} is what is holding this back, not your hands. A better one reaches your skill more often.`
        : 'Your skill is the ceiling; the tool decides how often a go reaches it.';
    name.append(worth);
    // What the name does not say: for a mould, the piece it is the only way to.
    if (r.note) {
      const note = document.createElement('small');
      note.className = 'craft-note';
      note.textContent = r.note;
      name.append(note);
    }
    const needs = document.createElement('div');
    needs.className = 'craft-needs';
    const parts: HTMLElement[] = [];
    if (r.station) {
      const station = document.createElement('span');
      station.className = st.station ? 'have' : 'lack';
      /*
       * What to do about it, in the row and not only on hover. A spindle or a
       * loom is a piece that stands on the ground and is worked standing at it;
       * one in the pack does not count. Reported by a player with a spindle in
       * their pack and twenty-one cotton, asking what they were doing wrong:
       * the row said "spindle" in red, and "Not within reach of one" to anybody
       * who hovered, which on a phone is nobody.
       */
      const name = stationName(r.station);
      const carried = !st.station && isFurniture(r.station) && this.game.inventory.has(r.station);
      station.textContent = st.station ? name : carried ? `${name}: set yours down` : `${name}: stand at one`;
      station.title = st.station
        ? 'You are standing at one'
        : carried
          ? `Yours is in your pack. Right-click the ground beside you, choose Set furniture down and your ${name}, and stand beside it.`
          : `Stand beside a ${name} that is on the ground.`;
      parts.push(station);
    }
    // Where it may be built at all: an altar goes up on a settlement of yours or nowhere.
    if (r.deed) {
      const deed = document.createElement('span');
      deed.className = st.deed ? 'have' : 'lack';
      deed.textContent = 'on your settlement';
      deed.title = st.deed ? 'You are standing on a settlement of yours' : DEED_ONLY;
      parts.push(deed);
    }
    // And one altar to a settlement: none built where one already stands.
    if (st.second) {
      const second = document.createElement('span');
      second.className = 'lack';
      second.textContent = 'one to a settlement';
      second.title = ONE_ALTAR;
      parts.push(second);
    }
    if (r.tool) {
      const tool = document.createElement('span');
      tool.className = st.tool ? 'have' : 'lack';
      tool.textContent = lower(r.tool);
      tool.title = st.tool ? 'Carried' : 'Not carried';
      parts.push(tool);
    }
    for (const i of st.inputs) {
      const span = document.createElement('span');
      span.className = i.have >= i.need ? 'have' : 'lack';
      span.textContent = `${i.need} ${lower(i.item)}`;
      // Where they are, so a crate that empties itself into a chest is never
      // a surprise: what is on you goes first, then the nearest store.
      const stored = i.have - i.carried;
      span.title = stored > 0
        ? `Have ${i.have}: ${i.carried} carried, ${stored} in your stores within ${reachFor(this.game, r)} tiles. What you carry is used first.`
        : `Have ${i.have}, carried`;
      const have = document.createElement('em');
      have.textContent = ` (${i.have})`;
      span.append(have);
      /*
       * Short of something: click it to see what makes it. Asked for as "click
       * a missing ingredient to jump to its recipe": a row that says it wants
       * tin you have not got was a dead end, and the recipe for the tin was a
       * search away that nothing pointed at. What no recipe makes is gathered,
       * and the help is opened at what it says about it instead.
       */
      if (i.have < i.need) {
        const makes = recipesMaking(i.item).length;
        span.classList.add('craft-find');
        span.title += makes
          ? `. Click for ${makes === 1 ? 'the recipe that makes it' : `the ${makes} recipes that make it`}.`
          : '. Nothing makes it at a bench: click to see what the help says about where it comes from.';
        span.addEventListener('click', () => {
          if (!this.showMaking(i.item)) this.onNoRecipe?.(i.item);
        });
      }
      parts.push(span);
    }
    // What it would come out made of, since the same bill in two woods makes
    // two different things; and a choice of them, when more than one kind is
    // carried. Asked for: an oak chest from a pack that holds pine too.
    const choices = materialChoices(this.game, r, stock);
    if (st.material && choices.length > 1) {
      const pick = document.createElement('select');
      pick.className = 'craft-of';
      pick.title = 'What to make it of';
      for (const m of choices) {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = `of ${m.toLowerCase()}`;
        o.selected = m === st.material;
        pick.append(o);
      }
      pick.addEventListener('change', () => {
        this.wants.set(r.id, pick.value);
        this.render();
      });
      parts.push(pick);
    } else if (st.material) {
      const made = document.createElement('span');
      made.className = 'have';
      made.textContent = `of ${st.material.toLowerCase()}`;
      made.title = r.wood ? `A ${lower(r.result)} is made of ${r.wood.toLowerCase()} and nothing else` : `Carry another kind, or keep one in a store within ${reachFor(this.game, r)} tiles, and you can choose between them here`;
      parts.push(made);
    }
    parts.forEach((p, k) => {
      if (k) needs.append(document.createTextNode(' · '));
      needs.append(p);
    });
    const buttons = document.createElement('div');
    buttons.className = 'craft-btns';
    const pinned = this.kept.pinned.includes(r.id);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'tb-btn tb-small craft-pin' + (pinned ? ' tb-on' : '');
    pin.textContent = pinned ? '★' : '☆';
    pin.title = pinned ? 'Unpin: take it out of Pinned at the top of the book' : 'Pin: keep it at the top of the book, under Pinned';
    pin.addEventListener('click', () => this.togglePin(r.id));
    buttons.append(pin);
    const craft = document.createElement('button');
    craft.type = 'button';
    craft.className = 'tb-btn tb-small';
    craft.textContent = 'Craft';
    craft.disabled = !st.ready;
    // Greyed, it says why in the island's own words.
    if (!st.ready) craft.title = recipeReason(r, this.game, undefined, stock) ?? '';
    craft.addEventListener('click', () => this.craft(r, 1));
    buttons.append(craft);
    if (st.max > 1) {
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'tb-btn tb-small';
      all.textContent = `× ${st.max}`;
      all.title = `Make ${st.max}, one after another`;
      all.addEventListener('click', () => this.craft(r, st.max));
      buttons.append(all);
    }
    row.append(name, buttons, needs);
    return row;
  }

  private craft(r: Recipe, times: number): void {
    const def = ACTION_BY_ID.get(r.id);
    // Start on a stack of whatever the window said it would be made of, so
    // clicking Craft makes the thing the row described -- the first one a
    // craft would reach, which is the pack's when there is one, and otherwise
    // the one in the nearest store.
    const stock = this.game.craftStock(undefined, false, reachFor(this.game, r));
    const want = recipeStatus(r, this.game, this.wants.get(r.id), stock).material;
    const first = r.inputs[0].item;
    const material = ((want ? stock.find((s) => s.item.id === first && s.item.extra === want) : undefined)
      ?? stock.find((s) => s.item.id === first))?.item;
    if (!def || !material) return;
    // The number of goes, which is the island's `p_times`. It used to ride
    // inside the target as `count`, where the island reads it as "how many of
    // the stack" and a craft reads it not at all.
    this.game.requestAction(def, { kind: 'item', uid: material.uid }, times);
  }
}
