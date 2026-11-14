import type { Game } from '../../game/game';
import { LAIR_TRACK, lairOfKind } from '../../game/lairs';
import { countsLine, entryTameLevel, guideEntries, guideEntry, GUIDE_MARKS, guideMarks, guidePage, keepable, MARK_NAMES, type GuideEntry, type GuideMark } from '../../game/guide';
import type { Island } from '../../net/island';
import { recordSaid, RECORD_STATS, type BredRecord } from '../../game/boards';
import { ACTION_BY_ID } from '../../game/actions';
import { degreesSays, TRACK, trackable, trackErr, trackLevel, trackReach, trackTarget, TRACKING } from '../../game/tracking';
import { CULL_RANGE, GATHER_VERB } from '../../game/creatures';
import { drawCreaturePortrait } from '../../render/sprites';
import { drawSoon, drawWildermonPortrait } from '../../render/wildermon';

/** How big a kind is drawn on the index and on its own page, in CSS pixels. */
const CARD = { w: 76, h: 56 };
const PAGE = { w: 150, h: 104 };
/** Which way round a kind is drawn: three quarters on, facing to the right. */
const FACING = 1;
/** The one colour a kind nobody has seen is drawn in. */
const SHADOW = '#4f4538';

/**
 * The field guide: every kind there is, as a collection. The index draws the
 * kinds you have seen and names them, and leaves the rest as their shape in
 * shadow; each has a page, turned to from the index, from the page either
 * side of it, or from a creature's own menu.
 *
 * Nothing here works anything out. The marks are the book's (`game.guide`) and
 * every line on a page is `guidePage`'s, read off the kind's definition. On an
 * island the book is the island's, asked for once each time the journal is
 * turned to its Field guide tab, and what comes back is added to what this
 * side already holds.
 */
export class GuidePanel {
  private readonly counts: HTMLDivElement;
  /**
   * Asked for: "add a search bar to field guide". Narrows the index to the kinds seen whose name, line or task has
   * what is typed in it; a kind not yet seen is not shown while searching, since its name is not known. Outside the
   * index's redraw, so typing keeps its place; the cards are hidden, not redrawn (`findCards`).
   */
  private readonly search: HTMLInputElement;
  /**
   * Asked for: a "Tameable now" filter. On, the index keeps the kinds and stages seen whose taming (`entryTameLevel`)
   * is at or under your Taming; never a monster. With the search, both must hold.
   */
  private readonly tameable: HTMLButtonElement;
  private tameOnly = false;
  private readonly found: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly view: HTMLDivElement;
  /** The page open (a kind, or `species:stage` for one of its stages), or null for the index. */
  private page: string | null = null;
  /** Pictures already drawn, by kind and by whether it has been seen, since a drawing does not change. */
  private readonly pictures = new Map<string, HTMLCanvasElement>();
  /** What was last drawn, so a mark that changes nothing on screen redraws nothing. */
  private drawn = '';
  /** Whether the island's answer is on its way, and whether the last ask came back empty. */
  private asking = false;
  private failed = false;
  /** The island's bred records (`rpc_bred_records`), asked with the book. */
  private records: BredRecord[] = [];

  /**
   * Drawn into `host`, the journal's Field guide tab (`JournalPanel`), and
   * redrawn only while `showing` says that tab can be seen; `turnHere` opens
   * the journal at it.
   */
  constructor(
    private readonly host: HTMLElement,
    private readonly game: Game,
    private readonly island: Island | null,
    private readonly showing: () => boolean,
    private readonly turnHere: () => void,
  ) {
    host.classList.add('guide-body');
    this.counts = document.createElement('div');
    this.counts.className = 'guide-counts';
    this.bar = document.createElement('div');
    this.bar.className = 'panel-bar guide-bar';
    this.view = document.createElement('div');
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search guide-search';
    this.search.placeholder = 'Search: name, line or task';
    this.search.setAttribute('aria-label', 'Search the field guide');
    this.search.addEventListener('input', () => this.findCards());
    this.tameable = document.createElement('button');
    this.tameable.type = 'button';
    this.tameable.className = 'tb-btn tb-small guide-tameable';
    this.tameable.setAttribute('aria-pressed', 'false');
    this.tameable.addEventListener('click', () => {
      this.tameOnly = !this.tameOnly;
      this.findCards();
    });
    this.found = document.createElement('div');
    this.found.className = 'guide-how';
    this.found.hidden = true;
    host.append(this.counts, this.search, this.tameable, this.found, this.bar, this.view);
    game.events.on('guide', () => {
      if (this.showing()) this.draw();
    });
    // Nothing is drawn until the tab is turned to: forty pictures nobody may look at.
  }

  /** The tab has just been turned to, or the journal opened at it: draw, and ask the island. */
  shown(): void {
    void this.refresh();
  }

  /** Open the book at a kind's page, or a stage's. */
  openAt(species: string): void {
    this.page = guideEntry(species) ? species : null;
    if (this.showing()) this.draw();
    this.turnHere();
  }

  /** Asked of the island once as the tab is turned to; alone, the book is already here. */
  private async refresh(): Promise<void> {
    this.draw();
    if (!this.island || this.asking) return;
    this.asking = true;
    try {
      const [book, records] = await Promise.all([this.island.guide(), this.island.bredRecords()]);
      this.failed = !book;
      if (book) this.game.guideRead(book);
      if (records) this.records = records;
    } finally {
      this.asking = false;
    }
    this.draw();
  }

  private draw(): void {
    const g = this.game.guide;
    // And the Tracking the Track button's hover is read at.
    const key = `${this.page}|${this.failed}|${JSON.stringify(this.records)}|${trackLevel(this.game.skills.get(TRACKING))}|${this.taming()}|${[...g.seen].sort()}|${[...g.tamed].sort()}|${[...g.bred].sort()}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.counts.textContent = countsLine(g);
    this.counts.title = 'Seen: of all kinds. Tamed, bred: of kinds that can be (not monsters)';
    this.bar.replaceChildren();
    this.view.replaceChildren();
    if (this.failed) this.say('Island did not answer: showing its last reply. Asked again each time this tab opens.');
    const entry = this.page ? guideEntry(this.page) : undefined;
    if (entry) this.drawPage(entry);
    else this.drawIndex();
  }

  /** Every kind, a card each: drawn and named once seen, a shadow until then. */
  private drawIndex(): void {
    this.bar.hidden = true;
    this.search.hidden = false;
    this.tameable.hidden = false;
    const grid = document.createElement('div');
    grid.className = 'guide-grid';
    const g = this.game.guide;
    // How a shadow becomes a page, while there are shadows left.
    if (guideEntries().some((e) => !g.seen.has(e.key))) {
      const how = document.createElement('div');
      how.className = 'guide-how';
      how.textContent = 'A kind, and each stage of one, is added the first time one is in sight. Click a card for its page.';
      this.view.append(how);
    }
    guideEntries().forEach((entry, i) => {
      const { def } = entry;
      const seen = g.seen.has(entry.key);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `guide-card${seen ? '' : ' guide-unseen'}${entry.stage ? ' guide-stage' : ''}`;
      card.append(this.picture(entry, seen, CARD.w, CARD.h));
      const name = document.createElement('span');
      name.className = 'guide-name';
      name.textContent = seen ? entry.name : `No. ${i + 1}`;
      card.append(name);
      const tags = document.createElement('span');
      tags.className = 'guide-tags';
      for (const m of ['tamed', 'bred'] as const) {
        if (!keepable(def) || !guideMarks(entry.key).includes(m) || !g.has(entry.key, m)) continue;
        const tag = document.createElement('span');
        tag.className = 'guide-tag';
        tag.textContent = MARK_NAMES[m].toLowerCase();
        tags.append(tag);
      }
      card.append(tags);
      card.title = seen ? `${entry.name}${entry.stage ? ` (${def.name}, stage ${entry.stage + 1})` : ''}: ${this.marksSaid(entry)}` : 'Not seen yet';
      card.addEventListener('click', () => this.turnTo(entry.key));
      // What a search finds it by, once seen: its name, its line's, and its task.
      card.dataset.find = seen ? [entry.name, def.name, def.gathers ? GATHER_VERB[def.gathers] : ''].join(' ').toLowerCase() : '';
      // And the taming it asks, once seen, for Tameable now; none for a monster.
      const tame = entryTameLevel(entry);
      card.dataset.tame = seen && tame !== null ? String(tame) : '';
      grid.append(card);
    });
    this.view.append(grid);
    this.findCards();
  }

  /** Your Taming, whole, as an offering is refused under it (`Need taming N`). */
  private taming(): number {
    return Math.floor(this.game.skills.get('taming'));
  }

  /** The index narrowed to what the search has in it and, with Tameable now on, to what you can tame; and how many that leaves. */
  private findCards(): void {
    const q = this.search.value.trim().toLowerCase();
    const skill = this.taming();
    this.tameable.textContent = `Tameable now (Taming ${skill})`;
    this.tameable.title = `${this.tameOnly ? 'Showing' : 'Show'} only kinds and stages seen with taming ${skill} or under; not monsters`;
    this.tameable.setAttribute('aria-pressed', String(this.tameOnly));
    this.tameable.classList.toggle('tb-on', this.tameOnly);
    const cards = [...this.view.querySelectorAll<HTMLElement>('.guide-card')];
    let shown = 0;
    for (const card of cards) {
      const tame = card.dataset.tame ?? '';
      const hide = (!!q && !(card.dataset.find ?? '').includes(q)) || (this.tameOnly && !(tame !== '' && Number(tame) <= skill));
      if (card.hidden !== hide) card.hidden = hide;
      if (!hide) shown++;
    }
    const narrowed = !!q || this.tameOnly;
    for (const how of this.view.querySelectorAll<HTMLElement>(':scope > .guide-how')) how.hidden = narrowed;
    this.found.hidden = !narrowed || this.page !== null;
    this.found.textContent = shown ? `${shown} of ${cards.length}`
      : q ? (this.tameOnly ? `None seen by that name or task at taming ${skill} or under.` : 'None seen by that name or task.')
        : `None seen at taming ${skill} or under.`;
  }

  /** One page: its picture and marks, and then what the book says of it, once it has been seen. */
  private drawPage(entry: GuideEntry): void {
    const { def } = entry;
    const pages = guideEntries();
    const at = pages.findIndex((e) => e.key === entry.key);
    this.bar.hidden = false;
    // A page is not searched; the search and the filter wait for the index.
    this.search.hidden = true;
    this.tameable.hidden = true;
    this.found.hidden = true;
    const button = (text: string, title: string, go: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small';
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', go);
      return b;
    };
    const back = pages[(at - 1 + pages.length) % pages.length];
    const next = pages[(at + 1) % pages.length];
    const where = document.createElement('span');
    where.className = 'guide-where';
    where.textContent = `No. ${at + 1} of ${pages.length}`;
    this.bar.append(
      button('Index', 'All kinds', () => this.turnTo(null)),
      button('‹', 'Previous page', () => this.turnTo(back.key)),
      button('›', 'Next page', () => this.turnTo(next.key)),
      where,
    );

    const seen = this.game.guide.seen.has(entry.key);
    const head = document.createElement('div');
    head.className = 'guide-head';
    head.append(this.picture(entry, seen, PAGE.w, PAGE.h));
    const side = document.createElement('div');
    side.className = 'guide-side';
    const name = document.createElement('div');
    name.className = 'guide-title';
    name.textContent = seen ? entry.name : 'Not seen yet';
    side.append(name);
    if (seen) {
      const marks = document.createElement('div');
      marks.className = 'guide-marks';
      // A stage's page is marked seen and tamed: breeding is its kind's.
      for (const m of GUIDE_MARKS) {
        if (m !== 'seen' && (!keepable(def) || !guideMarks(entry.key).includes(m))) continue;
        const chip = document.createElement('span');
        const has = this.game.guide.has(entry.key, m);
        chip.className = `guide-mark${has ? ' guide-mark-on' : ''}`;
        chip.textContent = MARK_NAMES[m];
        chip.title = has ? `${MARK_NAMES[m]}` : `Not ${MARK_NAMES[m].toLowerCase()} yet`;
        marks.append(chip);
      }
      side.append(marks);
    }
    // Track: a wildermon whose page is marked seen, read back to the nearest wild one, or a monster's lair (`tracking.ts`).
    const track = ACTION_BY_ID.get(TRACK);
    if (track && !entry.stage && trackable(def, this.game.guide.seen)) {
      const L = trackLevel(this.game.skills.get(TRACKING));
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'tb-btn tb-small guide-track';
      go.textContent = 'Track';
      // Alone, no further than the wild that is out (`trackAction.ts`).
      const reach = this.island ? trackReach(L, this.game.awareShare()) : Math.min(trackReach(L, this.game.awareShare()), CULL_RANGE);
      // A monster's: its kind's nearest lair (`LAIR_TRACK`).
      const lair = def.monster ? lairOfKind(def.id) : undefined;
      go.title = lair ? `Nearest ${lair.name.toLowerCase()} within ${LAIR_TRACK} tiles, bearing ±${degreesSays(trackErr(L))}° (Tracking ${L})`
        : `Nearest wild ${def.name} within ${reach} tiles, bearing ±${degreesSays(trackErr(L))}° (Tracking ${L})`;
      go.addEventListener('click', () => this.game.requestAction(track, trackTarget(this.game, def.id)));
      side.append(go);
    }
    head.append(side);
    this.view.append(head);
    // A kind nobody has seen is its shape and nothing else.
    if (!seen) return;
    // The island's best bred of it, a line a stat (`RECORD_STATS`), on a kind's own page.
    if (keepable(def) && !entry.stage) {
      const order = RECORD_STATS.map((r) => r.id);
      const its = this.records.filter((r) => r.species === def.id).sort((a, b) => order.indexOf(a.stat) - order.indexOf(b.stat));
      const h = document.createElement('div');
      h.className = 'skill-group';
      h.textContent = 'Bred records';
      const list = document.createElement('ul');
      list.className = 'guide-lines';
      for (const text of its.length ? its.map(recordSaid) : ['Record: none bred yet']) {
        const li = document.createElement('li');
        li.textContent = text;
        list.append(li);
      }
      this.view.append(h, list);
    }
    for (const s of guidePage(def, !!this.island, entry.stage, this.game.guide, this.game.lairsSeen)) {
      const h = document.createElement('div');
      h.className = 'skill-group';
      h.textContent = s.head;
      const list = document.createElement('ul');
      list.className = 'guide-lines';
      for (const line of s.lines) {
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
      }
      this.view.append(h, list);
    }
  }

  /** "seen, tamed, not bred yet", for a card's hover. */
  private marksSaid(entry: GuideEntry): string {
    const marks: GuideMark[] = keepable(entry.def) ? guideMarks(entry.key) : ['seen'];
    return marks.map((m) => (this.game.guide.has(entry.key, m) ? MARK_NAMES[m].toLowerCase() : `not ${MARK_NAMES[m].toLowerCase()} yet`)).join(', ');
  }

  private turnTo(species: string | null): void {
    this.page = species;
    this.draw();
    // A new page is read from the top, and so is the index come back to.
    this.host.scrollTop = 0;
  }

  /**
   * A kind's picture, drawn once at this size and kept: in its own colours
   * once seen, and as a shadow of its shape until then.
   */
  private picture(entry: GuideEntry, seen: boolean, w: number, h: number): HTMLCanvasElement {
    const { def } = entry;
    const key = `${entry.key}|${seen}|${w}x${h}`;
    let pic = this.pictures.get(key);
    if (!pic) {
      pic = document.createElement('canvas');
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      pic.width = Math.round(w * dpr);
      pic.height = Math.round(h * dpr);
      pic.style.width = `${w}px`;
      pic.style.height = `${h}px`;
      pic.className = 'guide-picture';
      const ctx = pic.getContext('2d');
      const p = pic;
      // Drawn a few at a frame rather than all of them before the tab shows (`drawSoon`). A stage is drawn as its
      // stage's model (`WILDERMON_STAGES`).
      if (ctx) drawSoon(() => {
        if (entry.stage) drawWildermonPortrait(ctx, p.width, p.height, def.id, def.variants[0], FACING, seen ? undefined : SHADOW, entry.stage);
        else drawCreaturePortrait(ctx, p.width, p.height, def.id, def.variants[0], FACING, seen ? undefined : SHADOW);
      });
      this.pictures.set(key, pic);
    }
    // Put in its new place, which takes it out of the old one: the index and a
    // page are never up at once, and they draw at different sizes anyway.
    return pic;
  }

  private say(text: string): void {
    const el = document.createElement('div');
    el.className = 'skill-note market-note';
    el.textContent = text;
    this.view.append(el);
  }
}
