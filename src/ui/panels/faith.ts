import {
  ALIGNMENT_NAMES, FAITH_TIER_AT, PATRON_AT, PATRON_BY_ID, PATRONS, SPELL_BAR, SPELLS_PER_TIER, slotsFor, spellOnText, spellsOf,
  type FaithSpellDef, type PatronDef, type PatronId,
} from '../../game/patrons';
import type { Game } from '../../game/game';
import {
  calmCap, CHOOSE_AT, PATH_LIST, PATH_TIER_AT, PATHS, PICKS_PER_TIER, picksOf, SIT_PLACES_SAID, type PathDef, type PathId, type PathPickDef, type PathSaid,
} from '../../game/meditation';
import { listed } from '../../game/words';
import { SKILL_BY_ID } from '../../game/skills';
import { FAITH } from '../../game/faith';
import { durationSaid } from '../../game/boons';
import { carriesRegret } from '../../game/baubles';
import type { FaithBook } from '../faithbook';
import { reveal, sharedWhy } from './trades';
import type { UIWindow } from '../windows';

/** The skill favour is held by, as the Skills window names it: "Devotion". */
const DEVOTION = SKILL_BY_ID.get(FAITH)?.name ?? FAITH;
const devotion = DEVOTION.toLowerCase();

/**
 * Faith: your patron, and the spells it gives.
 *
 * A tab for each of the three patrons, each laying open its tiers of spells,
 * so any of them can be read before one is taken; your own patron's tab is
 * the one that opens. Taking a patron and taking a spell are both kept until
 * a Bauble of Regret undoes the patron, and so is undoing one, so none of
 * them happens on one press: the first says what the second will do, as the
 * Trades window does.
 *
 * As there, nothing about you is worked out here. The island keeps your
 * patron, your spells and your bar (`faith_said`), and every refusal under a
 * button is the island's own sentence. What a patron offers is read from
 * `src/game/patrons.ts`, which is what the island's rows came from.
 *
 * And a **Path** tab beside the patrons: your meditation path, the Calm you
 * hold, and the tiers of every path that has moved onto them, with the
 * technique and two disciplines each offers and what each does
 * (`meditation.ts`). On an island it is the island's answer (`faith_said`'s
 * `path`); playing by yourself it is your own save's (`Game.pathSaid`), and a
 * technique is called from here rather than off a spell bar there is nobody
 * to keep.
 */
type Tab = PatronId | 'path';

/** How often the window asks again while it is open, in seconds. */
const REFRESH = 4;

export class FaithPanel {
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private readonly page: HTMLDivElement;
  private viewing: Tab = PATRONS[0].id;
  /** Whether a tab was clicked, after which your own patron no longer takes the window back. */
  private chose = false;
  /** The one choice waiting on its second press: `patron:<id>`, `spell:<id>`, `pick:<id>`, `undo:patron` or `undo:path`. */
  private confirming: string | null = null;
  /** The island's last refusal of a press in this window. */
  private why: string | null = null;
  private lastAsk = -1e9;
  /** The last answer drawn, so an unchanged one does not throw away the button under the pointer. */
  private seen = '';

  constructor(
    private readonly win: UIWindow,
    private readonly book: FaithBook,
    private readonly game: Game,
  ) {
    win.body.classList.add('trade-body');
    const bar = document.createElement('div');
    bar.className = 'trade-tabs log-tabs';
    for (const t of [...PATRONS.map((p): [Tab, string] => [p.id, p.name]), ['path', 'Path'] as [Tab, string]]) {
      const b = button(t[1], 'log-tab');
      b.addEventListener('click', () => {
        const moved = this.viewing !== t[0];
        this.viewing = t[0];
        this.chose = true;
        this.confirming = null;
        this.draw();
        // Another tab is another page, read from its top.
        if (moved) this.page.scrollTop = 0;
      });
      this.tabs.set(t[0], b);
      bar.append(b);
    }
    this.page = document.createElement('div');
    this.page.className = 'trade-page';
    win.body.append(bar, this.page);
    book.on(() => this.draw());
    win.onOpen = () => {
      this.lastAsk = -1e9;
      this.why = null;
      this.draw();
    };
    this.draw();
  }

  /** Asked on a clock while the window is up, because favour comes back and faith goes up while it is open. */
  update(now: number): void {
    if (!this.win.isOpen) return;
    if (now - this.lastAsk < REFRESH) return;
    this.lastAsk = now;
    // Playing by yourself there is nothing to ask: your path is your own save's, drawn again in case it moved.
    if (!this.book.island) this.draw();
    else void this.book.ask();
  }

  /** Your path as it stands: the island's answer, or your own save's playing by yourself. */
  private path(): PathSaid | null {
    return this.book.island ? this.book.said?.path ?? null : this.game.pathSaid();
  }

  private draw(): void {
    const s = this.book.said;
    if (!this.chose && s?.patron && PATRON_BY_ID.has(s.patron as PatronId)) this.viewing = s.patron as PatronId;
    const key = JSON.stringify([s, this.book.island ? null : this.path(), this.viewing, this.confirming, this.why, carriesRegret(this.game.inventory.items)]);
    if (key === this.seen) return;
    this.seen = key;
    for (const [id, b] of this.tabs) {
      b.classList.toggle('tb-on', id === this.viewing);
      b.setAttribute('aria-pressed', String(id === this.viewing));
    }
    const top = this.page.scrollTop;
    this.page.replaceChildren();
    this.drawPage();
    this.page.scrollTop = top;
    // A second press is drawn where its card was, which may be below the fold.
    const asked = this.confirming ? this.page.querySelector<HTMLElement>('.trade-confirm') : null;
    if (asked) reveal(this.page, asked);
  }

  private drawPage(): void {
    if (this.viewing === 'path') {
      this.drawPath();
      return;
    }
    const s = this.book.said;
    if (!s) {
      this.page.append(note('Loading faith…'));
    } else {
      this.page.append(this.standing(s));
    }
    if (this.why) this.page.append(whyEl(this.why));
    const p = PATRON_BY_ID.get(this.viewing);
    if (!p) return;
    this.page.append(this.patronCard(p));
    FAITH_TIER_AT.forEach((at, i) => this.page.append(this.tierBlock(p, i + 1, at)));
  }

  /**
   * Where you stand, at the head of a patron's tab: favour against what it
   * holds, which is what every spell here is paid from, then your faith and
   * the tier it opens next, and your patron.
   */
  private standing(s: NonNullable<FaithBook['said']>): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'faith-stand';
    box.append(meter('Favour', s.favour, s.cap, `Pays for spells and rites. Max set by ${devotion}.`));
    if (s.path) box.append(meter('Calm', s.path.calm, s.path.cap, 'Pays for path techniques. Gained by sitting on a rug.'));
    const mine = s.patron ? PATRON_BY_ID.get(s.patron as PatronId)?.name ?? s.patron : null;
    const next = FAITH_TIER_AT.find((at) => at > s.faith);
    const tier = next === undefined ? 'all faith tiers open' : `faith tier ${FAITH_TIER_AT.indexOf(next) + 1} at ${next}`;
    box.append(note(`${DEVOTION} ${s.faith.toFixed(1)} · ${tier} · ${mine ? `patron: ${mine}` : `patron at ${devotion} ${PATRON_AT}`}`));
    return box;
  }

  private patronCard(p: PatronDef): HTMLDivElement {
    const s = this.book.said;
    const card = document.createElement('div');
    card.className = 'trade-card';
    if (s?.patron === p.id) card.classList.add('trade-mine');
    const top = document.createElement('div');
    top.className = 'trade-card-top';
    const name = document.createElement('span');
    name.className = 'trade-name';
    name.textContent = p.name;
    const align = document.createElement('span');
    align.className = `faith-align faith-${p.alignment}`;
    align.textContent = ALIGNMENT_NAMES[p.alignment];
    top.append(name, align);
    card.append(top);
    card.append(cardNote(`Faith tiers at ${devotion} ${listed(FAITH_TIER_AT.map(String))}: pick 1 of ${SPELLS_PER_TIER} spells per faith tier, ${FAITH_TIER_AT.length} in all. Spell bar slots: ${slotsFor('faith')}.`));
    if (!s) return card;
    if (s.patron === p.id) {
      card.append(cardNote('Your patron. Spells below.'));
      const undo = this.undoActs('patron', `Undo ${p.name} as your patron?`, [
        `Removes ${p.name} and its ${s.taken.length} ${s.taken.length === 1 ? 'spell' : 'spells'}, off the spell bar. Uses a Bauble of Regret.`,
        `Then: any patron at ${devotion} ${PATRON_AT}.`,
      ], () => this.book.regretPatron());
      if (undo) card.append(undo);
      return card;
    }
    if (s.patron) return card;
    const ask = `patron:${p.id}`;
    if (this.confirming === ask) {
      card.append(this.confirm(`Take ${p.name} as your patron?`, [
        'Undo: Bauble of Regret, with its spells.',
        `Faith tier 1 opens with it; later faith tiers at ${devotion} ${listed(FAITH_TIER_AT.slice(1).map(String))}.`,
      ], `Take ${p.name}`, () => this.book.takePatron(p.id)));
      return card;
    }
    const why = s.patrons[p.id] ?? null;
    const acts = document.createElement('div');
    acts.className = 'trade-acts';
    const take = button(`Take ${p.name} as patron`, 'trade-take');
    take.disabled = !!why;
    take.addEventListener('click', () => {
      this.confirming = ask;
      this.why = null;
      this.draw();
    });
    acts.append(take);
    card.append(acts);
    if (why) card.append(whyEl(why));
    return card;
  }

  private tierBlock(p: PatronDef, tier: number, at: number): HTMLDivElement {
    const s = this.book.said;
    const block = document.createElement('div');
    block.className = 'trade-tier faith-tier';
    const open = !!s && s.faith >= at;
    if (s && !open) block.classList.add('trade-tier-shut');
    const head = document.createElement('div');
    head.className = 'trade-col-head';
    head.textContent = `Faith tier ${tier} · ${at} ${devotion}${s ? (open ? ' · open' : '') : ''}`;
    block.append(head);
    const spells = spellsOf(p.id, tier);
    if (!spells.length) {
      block.append(note(`Not written yet: ${SPELLS_PER_TIER} spells planned, pick 1.`));
      return block;
    }
    // The island's reason, said once under the tier when every spell still to take shares it.
    const shared = s && s.patron === p.id ? sharedWhy(spells.map((sp) => ({ taken: s.taken.includes(sp.id), why: s.spells[sp.id] ?? null }))) : null;
    if (shared) block.append(whyEl(shared));
    for (const sp of spells) block.append(this.spellCard(p, sp, !!shared));
    return block;
  }

  /** One spell. `quiet`: its tier already says why it cannot be taken. */
  private spellCard(p: PatronDef, sp: FaithSpellDef, quiet = false): HTMLDivElement {
    const s = this.book.said;
    const card = document.createElement('div');
    card.className = 'trade-node';
    const taken = !!s?.taken.includes(sp.id);
    if (taken) card.classList.add('trade-node-taken');
    const top = document.createElement('div');
    top.className = 'trade-card-top';
    const name = document.createElement('span');
    name.className = 'trade-node-name';
    name.textContent = sp.name;
    const cost = document.createElement('span');
    cost.className = 'trade-points';
    cost.textContent = `${sp.cost} favour · cooldown ${sp.rest} s`;
    top.append(name, cost);
    card.append(top, cardNote(`${sp.note} Target: ${spellOnText(sp)}.`));
    if (!s || s.patron !== p.id) return card;
    if (taken) {
      const slot = s.bar.indexOf(sp.id);
      if (slot >= 0) {
        card.append(cardNote(`Spell bar slot ${slot + 1} (Shift+${slot + 1}).`));
      } else {
        const acts = document.createElement('div');
        acts.className = 'trade-acts';
        const put = button('Add to spell bar', 'trade-take');
        put.addEventListener('click', () => void this.putOnBar(sp.id));
        acts.append(put);
        card.append(acts);
      }
      return card;
    }
    const ask = `spell:${sp.id}`;
    if (this.confirming === ask) {
      card.append(this.confirm(`Take ${sp.name} at faith tier ${sp.tier}?`, [
        `The other ${SPELLS_PER_TIER - 1} at this faith tier close while you hold ${p.name}.`,
      ], `Take ${sp.name}`, () => this.book.takeSpell(sp.id)));
      return card;
    }
    // One that cannot be taken has the island's reason rather than a button, here or on its tier.
    const why = s.spells[sp.id] ?? null;
    if (why) {
      card.classList.add('trade-node-shut');
      if (!quiet) card.append(whyEl(why));
      return card;
    }
    card.append(this.takeActs(ask));
    return card;
  }

  /** Into the first slot of the school with nothing in it, or the first of them when they are all full. */
  private async putOnBar(id: string, school: 'faith' | 'path' = 'faith'): Promise<void> {
    const bar = this.book.said?.bar ?? [];
    const mine = SPELL_BAR.map((sc, i) => (sc === school ? i : -1)).filter((i) => i >= 0);
    const slot = mine.find((i) => !bar[i]) ?? mine[0];
    this.why = await this.book.setSlot(slot, id);
    this.draw();
  }

  /* ---- The Path tab ------------------------------------------------------------ */

  private drawPath(): void {
    const ps = this.path();
    if (this.book.island && !ps) {
      this.page.append(note(this.book.said ? 'No path data from the island.' : 'Loading path…'));
    } else if (ps) {
      const mine = ps.way ? PATHS[ps.way]?.name ?? ps.way : null;
      const box = document.createElement('div');
      box.className = 'faith-stand';
      box.append(
        meter('Calm', ps.calm, ps.cap, 'Pays for path techniques. Gained by sitting on a rug.'),
        note(`Meditation ${ps.meditation.toFixed(1)} · ${mine ? `path: ${mine}` : `path at meditation ${CHOOSE_AT}, from the rug`}`),
      );
      this.page.append(box);
    }
    if (this.why) this.page.append(whyEl(this.why));
    this.page.append(note(`Calm: gained by sitting on a rug, spent on path techniques. Max Calm (same as max favour at that level): `
      + `${listed(PATH_TIER_AT.filter((_, i) => i % 2 === 0).map((m) => `${Math.floor(calmCap(m))} at meditation ${m}`))}.`));
    this.page.append(note(SIT_PLACES_SAID));
    const own = ps?.way ? PATHS[ps.way] : null;
    if (own && !own.moved) this.page.append(this.stepsCard(own, ps?.meditation ?? 0));
    for (const path of PATH_LIST.filter((p) => p.moved)) {
      this.page.append(this.pathCard(path, ps));
      PATH_TIER_AT.forEach((at, i) => this.page.append(this.pathTier(path, i + 1, at, ps)));
    }
  }

  /** A path still on its steps: what each step gives, at the meditation it takes. */
  private stepsCard(path: PathDef, med: number): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'trade-card trade-mine';
    const top = document.createElement('div');
    top.className = 'trade-card-top';
    const name = document.createElement('span');
    name.className = 'trade-name';
    name.textContent = path.name;
    top.append(name);
    card.append(top, cardNote(`${path.note} Steps by meditation (not yet on path tiers):`));
    for (const st of path.steps) {
      card.append(cardNote(`${st.at}${med >= st.at ? ' (yours)' : ''}: ${st.name}. ${st.note}${st.ability ? ` Used at the rug; cooldown ${durationSaid(st.ability.rest)}.` : ''}`));
    }
    return card;
  }

  private pathCard(path: PathDef, ps: PathSaid | null): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'trade-card';
    if (ps?.way === path.id) card.classList.add('trade-mine');
    const top = document.createElement('div');
    top.className = 'trade-card-top';
    const name = document.createElement('span');
    name.className = 'trade-name';
    name.textContent = path.name;
    top.append(name);
    card.append(top, cardNote(path.note));
    card.append(cardNote(`Path tiers at meditation ${listed(PATH_TIER_AT.map(String))}: 1 technique and ${PICKS_PER_TIER - 1} disciplines each; pick 1 per path tier, kept while you hold the path. `
      + 'Technique: spell bar path slot, costs Calm. Discipline: always on once taken.'));
    if (ps?.way === path.id) {
      card.append(cardNote('Your path. Picks below.'));
      const picks = ps.taken.length;
      const undo = this.undoActs('path', `Undo ${path.name} as your path?`, [
        `Removes ${path.name} and its ${picks} ${picks === 1 ? 'pick' : 'picks'}, techniques off the spell bar. Uses a Bauble of Regret.`,
        `Then: any path at the rug from meditation ${CHOOSE_AT}.`,
      ], () => this.book.regretPath());
      if (undo) card.append(undo);
    } else if (!ps?.way) {
      card.append(cardNote(`Chosen at the rug from meditation ${CHOOSE_AT}. Undo: Bauble of Regret.`));
    }
    return card;
  }

  private pathTier(path: PathDef, tier: number, at: number, ps: PathSaid | null): HTMLDivElement {
    const block = document.createElement('div');
    block.className = 'trade-tier faith-tier';
    const open = !!ps && ps.way === path.id && ps.meditation >= at;
    if (ps && ps.way === path.id && !open) block.classList.add('trade-tier-shut');
    const head = document.createElement('div');
    head.className = 'trade-col-head';
    head.textContent = `Path tier ${tier} · ${at} meditation${open ? ' · open' : ''}`;
    block.append(head);
    const picks = picksOf(path.id as PathId, tier);
    // As with spells: the island's reason once under the tier, when every pick still to take shares it.
    const shared = ps && ps.way === path.id ? sharedWhy(picks.map((k) => ({ taken: ps.taken.includes(k.id), why: ps.picks[k.id] ?? null }))) : null;
    if (shared) block.append(whyEl(shared));
    for (const k of picks) block.append(this.pickCard(k, ps, !!shared));
    return block;
  }

  /** One pick of a path's tier. `quiet`: its tier already says why it cannot be taken. */
  private pickCard(k: PathPickDef, ps: PathSaid | null, quiet = false): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'trade-node';
    const taken = !!ps?.taken.includes(k.id);
    if (taken) card.classList.add('trade-node-taken');
    const top = document.createElement('div');
    top.className = 'trade-card-top';
    const name = document.createElement('span');
    name.className = 'trade-node-name';
    name.textContent = k.name;
    const cost = document.createElement('span');
    cost.className = 'trade-points';
    cost.textContent = k.kind === 'technique' ? `Technique · ${k.cost} Calm · cooldown ${durationSaid(k.rest)}` : 'Discipline';
    top.append(name, cost);
    card.append(top, cardNote(k.kind === 'technique' ? `${k.note} Target: self.` : k.note));
    if (!ps || ps.way !== k.path) return card;
    if (taken) {
      if (k.kind === 'technique') card.append(this.techniqueActs(k));
      return card;
    }
    const ask = `pick:${k.id}`;
    if (this.confirming === ask) {
      card.append(this.confirm(`Take ${k.name} at path tier ${k.tier}?`, [
        `The other ${PICKS_PER_TIER - 1} at this path tier close while you hold ${PATHS[k.path]?.name ?? k.path}.`,
      ], `Take ${k.name}`, () => this.takePick(k.id)));
      return card;
    }
    const why = ps.picks[k.id] ?? null;
    if (why) {
      card.classList.add('trade-node-shut');
      if (!quiet) card.append(whyEl(why));
      return card;
    }
    card.append(this.takeActs(ask));
    return card;
  }

  /**
   * Undo on your own patron or path, for somebody on an island carrying a
   * Bauble of Regret, loose or in a bag: the first press asks, the second
   * breaks the bauble. One put by shows the button too, and the island says
   * why it will not break. Nothing without one.
   */
  private undoActs(what: 'patron' | 'path', ask: string, lines: string[], act: () => Promise<string | null>): HTMLDivElement | null {
    if (!this.book.island || !carriesRegret(this.game.inventory.items)) return null;
    const key = `undo:${what}`;
    if (this.confirming === key) return this.confirm(ask, lines, 'Undo', act);
    const acts = document.createElement('div');
    acts.className = 'trade-acts';
    const undo = button('Undo (uses Bauble of Regret)', 'trade-take');
    undo.addEventListener('click', () => {
      this.confirming = key;
      this.why = null;
      this.draw();
    });
    acts.append(undo);
    return acts;
  }

  /** The first press of a spell or a pick: it asks, and the second press does it. */
  private takeActs(ask: string): HTMLDivElement {
    const acts = document.createElement('div');
    acts.className = 'trade-acts';
    const take = button('Take', 'trade-take');
    take.addEventListener('click', () => {
      this.confirming = ask;
      this.why = null;
      this.draw();
    });
    acts.append(take);
    return acts;
  }

  /** A technique you hold: where it is on the bar, or a way onto it; and playing by yourself, a way to call it. */
  private techniqueActs(k: PathPickDef): HTMLDivElement {
    const acts = document.createElement('div');
    acts.className = 'trade-acts';
    if (!this.book.island) {
      const call = button(`Call ${k.name}`, 'trade-take');
      const why = this.game.techniqueRefusal(k.id);
      call.disabled = !!why;
      call.title = why ?? `Cost: ${k.cost} Calm`;
      call.addEventListener('click', () => {
        this.why = this.game.castTechnique(k.id);
        this.draw();
      });
      acts.append(call);
      if (why) acts.append(whyEl(why));
      return acts;
    }
    const slot = this.book.said?.bar.indexOf(k.id) ?? -1;
    if (slot >= 0) {
      acts.append(cardNote(`Spell bar slot ${slot + 1} (Shift+${slot + 1}).`));
      return acts;
    }
    const put = button('Add to spell bar', 'trade-take');
    put.addEventListener('click', () => void this.putOnBar(k.id, 'path'));
    acts.append(put);
    return acts;
  }

  private async takePick(id: string): Promise<string | null> {
    if (this.book.island) return this.book.takePathPick(id);
    return this.game.takePathPick(id);
  }

  /** The second press, and the way out of it. */
  private confirm(ask: string, lines: string[], yes: string, act: () => Promise<string | null>): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'trade-confirm';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', ask);
    const q = document.createElement('div');
    q.className = 'trade-confirm-ask';
    q.textContent = ask;
    box.append(q);
    for (const line of lines) {
      const d = document.createElement('div');
      d.className = 'trade-confirm-line';
      d.textContent = line;
      box.append(d);
    }
    const acts = document.createElement('div');
    acts.className = 'trade-acts';
    const go = button(yes, 'trade-take trade-go');
    go.addEventListener('click', () => {
      go.disabled = true;
      this.confirming = null;
      void act().then((why) => {
        this.why = why;
        this.draw();
      });
    });
    const no = button('Cancel', 'trade-take');
    no.addEventListener('click', () => {
      this.confirming = null;
      this.draw();
    });
    acts.append(go, no);
    box.append(acts);
    return box;
  }
}

function button(label: string, extra = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `tb-btn tb-small${extra ? ` ${extra}` : ''}`;
  b.textContent = label;
  return b;
}

/** A store of something spent, as a bar part-filled and its numbers. */
function meter(label: string, held: number, cap: number, title: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'faith-meter-row';
  row.title = title;
  const name = document.createElement('span');
  name.className = 'faith-meter-label';
  name.textContent = label;
  // The status panel's bar, so a store of favour reads like a store of stamina.
  const bar = document.createElement('span');
  bar.className = 'hud-bar faith-meter';
  bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-label', label);
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(cap));
  bar.setAttribute('aria-valuenow', String(held));
  const fill = document.createElement('span');
  fill.className = 'hud-bar-fill faith-meter-fill';
  fill.style.width = `${cap > 0 ? Math.min(100, (held / cap) * 100) : 0}%`;
  bar.append(fill);
  const num = document.createElement('span');
  num.className = 'trade-points';
  num.textContent = `${Math.floor(held)}/${Math.floor(cap)}`;
  row.append(name, bar, num);
  return row;
}

function note(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'trade-note';
  d.textContent = text;
  return d;
}

function cardNote(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'trade-card-note';
  d.textContent = text;
  return d;
}

/** The island's sentence, never ours: why this will not do anything. */
function whyEl(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'trade-why';
  d.textContent = text;
  return d;
}
