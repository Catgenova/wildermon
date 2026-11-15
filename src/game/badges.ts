import { COMBAT_CLASSES, CRAFT_CLASSES, MAGIC_CLASSES, classDef } from './classes';

/**
 * The trade and the class somebody holds, as icons before their name: in
 * chat, over their head and in the Social window (`src/render/emblems.ts`
 * draws them).
 *
 * A trade is a craft class (`CRAFT_CLASSES`, `player.craft_class` on the
 * island) and a class is a fighting or a magic one (`COMBAT_CLASSES`,
 * `MAGIC_CLASSES`, `player.combat_class`). Both are read off the island's
 * `player` rows, never off what another browser broadcasts, so nobody can
 * wear a trade they have not taken. An id this browser does not know is
 * none, as a body nobody has taken a trade on is none.
 */

/** Somebody's trade and class, by class id; null for none. */
export interface NameBadges {
  trade: string | null;
  cls: string | null;
}

export const NO_BADGES: NameBadges = Object.freeze({ trade: null, cls: null });

const TRADE_IDS: ReadonlySet<string> = new Set(CRAFT_CLASSES.map((c) => c.id));
const CLASS_IDS: ReadonlySet<string> = new Set([...COMBAT_CLASSES, ...MAGIC_CLASSES].map((c) => c.id));

/** Every id with an icon: the trades, then the classes. */
export const BADGE_IDS: readonly string[] = [...TRADE_IDS, ...CLASS_IDS];

/** Whether an id is a trade's (round badge) rather than a class's (shield). */
export const isTrade = (id: string): boolean => TRADE_IDS.has(id);

/** A `player` row's two columns, checked against the trades and classes there are. */
export function badgesOf(craft: unknown, combat: unknown): NameBadges {
  const trade = typeof craft === 'string' && TRADE_IDS.has(craft) ? craft : null;
  const cls = typeof combat === 'string' && CLASS_IDS.has(combat) ? combat : null;
  return trade || cls ? { trade, cls } : NO_BADGES;
}

/** The icons to show, trade first, as ids; none with the setting off. */
export const badgeIds = (b: NameBadges | undefined, on: boolean): string[] =>
  !on || !b ? [] : [b.trade, b.cls].filter((x): x is string => x !== null);

/** An icon's tooltip: "Trade: Smith", "Class: Sworn Blade". */
export const badgeTitle = (id: string): string => `${isTrade(id) ? 'Trade' : 'Class'}: ${classDef(id)?.name ?? id}`;

/** Seconds before a uid the island had no row for is asked after again. */
export const BADGE_ASK_AGAIN = 300;
/** Most uids asked after in one read. */
export const BADGE_ASK_MOST = 100;

/**
 * Everybody's icons this browser knows, by uid.
 *
 * Filled from the roster's read of everybody ashore (`saw`, every
 * `RECONCILE_EVERY`), and for somebody not ashore -- a line of talk from
 * before you came, a friend who is away -- from one read of their rows when
 * first wanted (`want`, through `ask`). Each change is told (`changed`), so
 * a chat line drawn before its speaker was known is filled in after.
 */
export class BadgeBook {
  private by = new Map<string, NameBadges>();
  /** When each unknown uid was last asked after, in seconds on the page's clock. */
  private asked = new Map<string, number>();
  private waiting = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Reads the rows of these uids; set on an island (`play.ts`). Unset, nothing is asked. */
  ask: ((uids: string[]) => Promise<Array<{ uid: string; craft_class?: unknown; combat_class?: unknown }>>) | null = null;

  constructor(
    /** Told the uids whose icons changed. */
    private readonly changed: (uids: string[]) => void = () => {},
    private readonly now: () => number = () => performance.now() / 1000,
  ) {}

  /** What is known of somebody, or undefined when nothing is yet. */
  get(uid: string | undefined): NameBadges | undefined {
    return uid ? this.by.get(uid) : undefined;
  }

  /** Rows read off the island: each one's trade and class, as of now. */
  saw(rows: ReadonlyArray<{ uid: string; craft_class?: unknown; combat_class?: unknown }>): void {
    const moved: string[] = [];
    for (const r of rows) {
      if (typeof r.uid !== 'string' || !r.uid) continue;
      const b = badgesOf(r.craft_class, r.combat_class);
      const had = this.by.get(r.uid);
      this.waiting.delete(r.uid);
      if (had && had.trade === b.trade && had.cls === b.cls) continue;
      this.by.set(r.uid, b);
      moved.push(r.uid);
    }
    if (moved.length) this.changed(moved);
  }

  /** Somebody is about to be drawn: ask after them if nothing is known and they were not asked after lately. */
  want(uid: string | undefined): void {
    if (!uid || this.by.has(uid) || !this.ask || this.waiting.has(uid)) return;
    const at = this.asked.get(uid);
    if (at !== undefined && this.now() - at < BADGE_ASK_AGAIN) return;
    this.waiting.add(uid);
    this.timer ??= setTimeout(() => this.flush(), 0);
  }

  private flush(): void {
    this.timer = null;
    const ask = this.ask;
    if (!ask || !this.waiting.size) return;
    const uids = [...this.waiting].slice(0, BADGE_ASK_MOST);
    const now = this.now();
    for (const u of uids) {
      this.waiting.delete(u);
      this.asked.set(u, now);
    }
    if (this.waiting.size) this.timer = setTimeout(() => this.flush(), 0);
    void ask(uids).then((rows) => this.saw(rows), () => undefined);
  }
}
