import type { Game } from '../game/game';
import { itemDef } from '../game/items';
import { INGOT_LUMPS, ingotOf, METAL_BY_LUMP } from '../game/metal';
import { needOf, reachFor, recipeStatus, skillName, stationName, type CraftStock, type Recipe } from '../game/recipes';
import { keepControlKeys } from './controlkeys';
import { uiBox, uiPoint } from './screen';

/** How many recipes deep the tree goes before it says "…" instead. */
export const TREE_DEPTH = 4;
/** How long the pointer rests on a missing part before its tree comes up, and how long it may stray before it goes. */
const SHOW_AFTER = 250;
const HIDE_AFTER = 200;

/** One part in the tree: how many of it the go above it takes, how many are at hand, and how it is made. */
interface Part {
  item: string;
  tool: boolean;
  need: number;
  have: number;
  carried: number;
  /** The recipe followed for it, when one makes it and the tree goes this deep. */
  recipe?: Recipe;
  /** How many recipes make it, of which `recipe` is the first that can be made now, else the first. */
  recipes: number;
  ready: boolean;
  /** Goes of `recipe` it would take to make what is short. */
  goes: number;
  parts: Part[];
  /** Not followed further: deeper than `TREE_DEPTH`, or already a step above it. */
  cut?: 'deep' | 'cycle';
}

const lower = (id: string): string => itemDef(id).name.toLowerCase();

/**
 * How a missing part is made, down to what is gathered.
 *
 * Asked for: hovering a missing ingredient or tool in a recipe row pops out
 * a tree of how to make it. Each part says how many the go above it takes and
 * how many are at hand (the pack, the bags and, with Settings' stores on, the
 * stores within reach, as the row counts them); a part you hold enough of is
 * not followed, since nothing about it needs making. Where several recipes
 * make a thing, the first you can make now is followed, else the first. It
 * goes `TREE_DEPTH` recipes deep and says "…" past that, and never follows a
 * thing into itself.
 *
 * Hover or keyboard focus shows it; a long press (a right click) pins it on a
 * touch screen, where there is no hover. Every line in it is a button to that
 * thing's recipes, by the same jump a click on the row's part makes.
 */
export class RecipeTree {
  private el: HTMLDivElement | null = null;
  private anchor: HTMLElement | null = null;
  private showing: number | undefined;
  private hiding: number | undefined;
  private pinned = false;
  private readonly offPress = (e: PointerEvent): void => {
    const t = e.target as Node | null;
    if (this.el?.contains(t) || this.anchor?.contains(t)) return;
    this.hide();
  };

  constructor(
    private readonly game: Game,
    private readonly makes: (item: string) => Recipe[],
    private readonly jump: (item: string) => void,
  ) {}

  /** Give a missing part on a row its tree. `r` is the row's recipe, whose reach the counts are taken at. */
  attach(span: HTMLElement, item: string, need: number, tool: boolean, r: Recipe): void {
    const open = (pin: boolean): void => {
      clearTimeout(this.hiding);
      clearTimeout(this.showing);
      this.show(span, item, need, tool, r, pin);
    };
    span.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || this.pinned) return;
      clearTimeout(this.hiding);
      clearTimeout(this.showing);
      this.showing = window.setTimeout(() => open(false), this.anchor === span ? 0 : SHOW_AFTER);
    });
    span.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(this.showing);
      if (this.anchor === span && !this.pinned) this.hideSoon();
    });
    span.addEventListener('focus', () => {
      if (span.matches(':focus-visible')) open(false);
    });
    span.addEventListener('blur', (e) => {
      const to = e.relatedTarget as Node | null;
      if (this.anchor === span && !this.pinned && !(to && this.el?.contains(to))) this.hide();
    });
    span.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(true);
    });
    span.addEventListener('keydown', (e) => {
      if (this.anchor !== span || !this.el || this.el.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        this.el.querySelector<HTMLElement>('.rtree-node')?.focus();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        this.hide();
      }
    });
  }

  /** Take it down, wherever it is. */
  hide(): void {
    clearTimeout(this.showing);
    clearTimeout(this.hiding);
    this.pinned = false;
    this.anchor = null;
    if (this.el) this.el.hidden = true;
    document.removeEventListener('pointerdown', this.offPress, true);
  }

  private hideSoon(): void {
    clearTimeout(this.hiding);
    this.hiding = window.setTimeout(() => this.hide(), HIDE_AFTER);
  }

  /** The popover itself, made once and put on the interface's root beside the tooltip. */
  private box(root: HTMLElement): HTMLDivElement {
    if (this.el && this.el.parentElement === root) return this.el;
    const el = this.el ?? document.createElement('div');
    el.className = 'tooltip tooltip-wide rtree';
    el.setAttribute('role', 'dialog');
    el.hidden = true;
    if (!this.el) {
      keepControlKeys(el);
      el.addEventListener('pointerenter', () => clearTimeout(this.hiding));
      el.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse' && !this.pinned) this.hideSoon();
      });
      el.addEventListener('focusout', (e) => {
        const to = e.relatedTarget as Node | null;
        if (!this.pinned && !(to && (el.contains(to) || this.anchor?.contains(to)))) this.hide();
      });
      el.addEventListener('keydown', (e) => {
        const nodes = [...el.querySelectorAll<HTMLElement>('.rtree-node')];
        const at = nodes.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = at + (e.key === 'ArrowDown' ? 1 : -1);
          if (next < 0) this.anchor?.focus();
          else nodes[Math.min(nodes.length - 1, next)]?.focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const back = this.anchor;
          this.hide();
          back?.focus();
        }
        e.stopPropagation();
      });
    }
    root.append(el);
    this.el = el;
    return el;
  }

  private show(span: HTMLElement, item: string, need: number, tool: boolean, r: Recipe, pin: boolean): void {
    const root = span.closest<HTMLElement>('.win')?.parentElement;
    if (!root || !span.isConnected) return;
    const el = this.box(root);
    if (this.anchor !== span || el.hidden) {
      const tree = this.grow(item, need, tool, reachFor(this.game, r));
      el.replaceChildren(this.draw(tree, true), this.foot(reachFor(this.game, r)));
    }
    this.anchor = span;
    this.pinned = pin;
    el.hidden = false;
    if (pin) document.addEventListener('pointerdown', this.offPress, true);
    this.place(span, el);
  }

  /** Under the part, or over it when there is no room below; never off the screen. */
  private place(span: HTMLElement, el: HTMLDivElement): void {
    const b = span.getBoundingClientRect();
    const tl = uiPoint({ clientX: b.left, clientY: b.top });
    const br = uiPoint({ clientX: b.right, clientY: b.bottom });
    const box = uiBox();
    el.style.maxHeight = '';
    el.style.left = '0px';
    el.style.top = '0px';
    const w = el.offsetWidth;
    const below = box.h - br.y - 8;
    const above = tl.y - 8;
    const room = Math.max(below, above);
    if (el.offsetHeight > room) el.style.maxHeight = `${Math.max(80, room)}px`;
    const h = el.offsetHeight;
    const left = Math.max(4, Math.min(box.w - w - 4, tl.x));
    const top = h <= below || below >= above ? br.y + 4 : tl.y - h - 4;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(4, top)}px`;
  }

  /** The tree, measured against what is at hand at `reach`. */
  private grow(item: string, need: number, tool: boolean, reach: number): Part {
    const stocks = new Map<number, readonly CraftStock[]>();
    const stockAt = (n: number): readonly CraftStock[] => {
      let s = stocks.get(n);
      if (!s) stocks.set(n, (s = this.game.craftStock(undefined, false, n)));
      return s;
    };
    const held = (id: string, at: number, isTool: boolean): { have: number; carried: number } => {
      // A tool counts only carried, as a row's tool does; stores are never searched for one.
      if (isTool) {
        const n = this.game.inventory.items.filter((it) => it.id === id).length;
        return { have: n, carried: n };
      }
      const metal = METAL_BY_LUMP.get(id);
      const bar = metal ? ingotOf(metal) : undefined;
      let have = 0;
      let carried = 0;
      for (const s of stockAt(at)) {
        const per = s.item.id === id ? 1 : s.item.id === bar ? INGOT_LUMPS : 0;
        if (!per) continue;
        have += s.item.count * per;
        if (s.carried) carried += s.item.count * per;
      }
      return { have, carried };
    };
    const walk = (id: string, n: number, isTool: boolean, at: number, depth: number, above: ReadonlySet<string>): Part => {
      const { have, carried } = held(id, at, isTool);
      const all = this.makes(id);
      const node: Part = { item: id, tool: isTool, need: n, have, carried, recipes: all.length, ready: false, goes: 0, parts: [] };
      // Enough of it at hand: nothing about it needs making. The part asked about always does.
      if (!all.length || (depth > 0 && have >= n)) return node;
      if (above.has(id)) {
        node.cut = 'cycle';
        return node;
      }
      if (depth >= TREE_DEPTH) {
        node.cut = 'deep';
        return node;
      }
      const statuses = all.map((r) => ({ r, ready: recipeStatus(r, this.game, undefined, stockAt(reachFor(this.game, r))).ready }));
      const pick = statuses.find((s) => s.ready) ?? statuses[0];
      const r = pick.r;
      node.recipe = r;
      node.ready = pick.ready;
      node.goes = Math.max(1, Math.ceil(Math.max(1, n - have) / this.game.madeAGo(r)));
      const next = new Set(above).add(id);
      const reach = reachFor(this.game, r);
      if (r.tool) node.parts.push(walk(r.tool, 1, true, reach, depth + 1, next));
      for (const i of r.inputs) node.parts.push(walk(i.item, needOf(this.game, r, i) * node.goes, false, reach, depth + 1, next));
      return node;
    };
    return walk(item, need, tool, reach, 0, new Set());
  }

  private draw(n: Part, top = false): HTMLElement {
    const li = document.createElement(top ? 'div' : 'li');
    li.className = top ? 'rtree-root' : 'rtree-item';
    const line = document.createElement('button');
    line.type = 'button';
    line.className = 'rtree-node';
    const enough = n.tool ? n.have > 0 : n.have >= n.need;
    const mark = document.createElement('span');
    mark.className = `rtree-mark ${enough ? 'have' : 'lack'}`;
    mark.textContent = enough ? '✓' : '✗';
    mark.setAttribute('aria-label', enough ? 'at hand' : 'short');
    const name = document.createElement('span');
    name.className = 'rtree-name';
    name.textContent = n.tool ? lower(n.item) : `${n.need} ${lower(n.item)}`;
    const have = document.createElement('span');
    have.className = 'rtree-have';
    const stored = n.have - n.carried;
    have.textContent = n.tool
      ? (n.have ? 'carried' : 'not carried')
      : stored > 0 ? `have ${n.have} (${stored} stored)` : `have ${n.have}`;
    line.append(mark, name, have);
    line.title = n.recipes
      ? `Open ${n.recipes === 1 ? 'the recipe that makes' : `the ${n.recipes} recipes that make`} ${lower(n.item)}`
      : `No recipe makes ${lower(n.item)}: click for its source in the help`;
    line.addEventListener('click', () => {
      const item = n.item;
      this.hide();
      this.jump(item);
    });
    li.append(line);
    const r = n.recipe;
    if (r) {
      const how = document.createElement('div');
      how.className = 'rtree-how';
      const made = this.game.madeAGo(r);
      const bits = [`${r.label} × ${n.goes}`, skillName(r.skill)];
      if (made > 1) bits.push(`makes ${made} per action`);
      if (r.station) bits.push(`at a ${stationName(r.station)}`);
      if (n.recipes > 1) bits.push(n.ready ? `first of ${n.recipes} recipes; makeable now` : `first of ${n.recipes} recipes; none makeable now`);
      how.textContent = bits.join(' · ');
      li.append(how);
    } else if (!n.recipes && !(n.tool ? n.have > 0 : n.have >= n.need)) {
      const how = document.createElement('div');
      how.className = 'rtree-how';
      how.textContent = 'No recipe: click for its source';
      li.append(how);
    } else if (n.cut) {
      const how = document.createElement('div');
      how.className = 'rtree-how';
      how.textContent = n.cut === 'cycle' ? `… made from ${lower(n.item)} above; not repeated` : `… depth ${TREE_DEPTH} reached; open its recipe for more`;
      li.append(how);
    }
    if (n.parts.length) {
      const ul = document.createElement('ul');
      ul.className = 'rtree-parts';
      for (const p of n.parts) ul.append(this.draw(p));
      li.append(ul);
    }
    return li;
  }

  /** What the counts count, as the window's head says it. */
  private foot(reach: number): HTMLElement {
    const foot = document.createElement('div');
    foot.className = 'rtree-foot';
    foot.textContent = `Have: ${this.game.settings.fromStores ? `pack, bags and stores within ${reach} tiles` : 'pack and bags'}. `
      + 'Parts you have enough of are not expanded. Click a line: its recipe.';
    return foot;
  }
}
