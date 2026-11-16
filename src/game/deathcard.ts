/**
 * The card over the respawn chooser: how the body died.
 *
 * Asked for: "a summary card at death with how you died". The island keeps it on the fall (`private.fallen`:
 * `player_die`, `private.fall_note`) and says it on the offer (`respawn_offer`): what took the last of the health
 * (`cause`), the last blows that landed (`blows`), what became of what was carried (`things`), when (`at`, and the
 * island's clock then, `clock`) and the region it fell in (`region`). An island from before it says none of these,
 * and the card says what is known: where the body fell.
 *
 * A leaf but for the words, the wounds, the regions, the calendar and the death grace: the chooser
 * (`src/ui/respawn.ts`) reads it; `supabase/test/deathchooser.ts` holds both sides to it.
 */
import { graceKeptSaid } from './deathgrace';
import { DAY_SECONDS } from './pace';
import { PART_NAMES, WOUND_KINDS, type WoundKind } from './wounds';
import { percent, waitWords } from './words';
import { OCEAN_REGION, REGIONS } from '../world/regions';
import { seasonLine } from '../world/calendar';

/** What took the last of the health, as the island keeps it (`private.fallen.cause`). */
export type DeathKind = 'blow' | 'bled' | 'drowned' | 'lava' | 'heat' | 'bond' | 'oath';

export interface DeathCause {
  kind: DeathKind;
  /** What struck: a creature's kind as a fight names it, or the one sworn to (an oath). */
  by: string | null;
  /** The creature's own name, where it is not its kind's. */
  name: string | null;
}

/** A blow that landed, oldest first; `kill` on the one that killed. */
export interface DeathBlow {
  by: string;
  name: string | null;
  /** The wound (`WOUND_KINDS`) and where (`PART_NAMES`). */
  what: string | null;
  part: string | null;
  /** The share of health it took. */
  taken: number | null;
  kill: boolean;
}

/** What became of what was carried: the death grace's seconds left, a grave (where, how many things, how long it keeps), or nothing carried (the island's `grave: false`). */
export type DeathThings = { grace: number } | { grave: { x: number; y: number; n: number; keeps: number } | null };

/** The death as the offer says it; every part may be missing. */
export interface Death {
  /** When, in epoch milliseconds, and the island's clock then (seconds since it began, as `world_time`). */
  at: number | null;
  clock: number | null;
  region: number | null;
  cause: DeathCause | null;
  blows: DeathBlow[];
  things: DeathThings | null;
}

/** Seconds after a death in which a step off the spawn is held, as said before the death. The island's `respawn_hold`. */
export const RESPAWN_HOLD = 10;
/** The most blows the card lists, and how long before the death a blow is one of them, in seconds. The island's `death_blows`, `death_blows_secs`. */
export const DEATH_BLOWS = 5;
export const DEATH_BLOWS_SECS = 300;

/** One row of the card: a label and its lines. */
export interface DeathRow {
  label: string;
  lines: string[];
}

/** The card's title, and its rows' labels. */
export const DEATH_TITLE = 'Death';
export const CAUSE_LABEL = 'Cause';
export const BLOWS_LABEL = 'Last blows';
export const WHERE_LABEL = 'Where';
export const THINGS_LABEL = 'Your things';
export const WHEN_LABEL = 'When';
/** What each cause is called on the card. */
export const CAUSE_SAID: Record<DeathKind, string> = {
  blow: 'Killed by',
  bled: 'Bled out',
  drowned: 'Drowned',
  lava: 'Burned: lava',
  heat: 'Heat',
  bond: 'Feral Bond',
  oath: 'Oath',
};
export const KILLING_BLOW = 'Killing blow';
export const NOTHING_CARRIED = 'Nothing carried';
export const SEA_SAID = 'Open sea';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** The death said on an offer (`respawn_offer`): null when it says none of it, which an island from before it does not. */
export function deathIn(o: Record<string, unknown>): Death | null {
  const at = typeof o.at === 'string' ? Date.parse(o.at) : NaN;
  const c = o.cause && typeof o.cause === 'object' ? (o.cause as Record<string, unknown>) : null;
  const cause: DeathCause | null = c && typeof c.kind === 'string' && c.kind in CAUSE_SAID
    ? { kind: c.kind as DeathKind, by: str(c.by), name: str(c.name) } : null;
  const blows: DeathBlow[] = [];
  for (const b of Array.isArray(o.blows) ? o.blows : []) {
    const e = (b ?? {}) as Record<string, unknown>;
    const by = str(e.by);
    if (!by) continue;
    blows.push({ by, name: str(e.name), what: str(e.what), part: str(e.part), taken: num(e.taken) ? e.taken : null, kill: e.kill === true });
  }
  let things: DeathThings | null = null;
  const t = o.things && typeof o.things === 'object' ? (o.things as Record<string, unknown>) : null;
  if (t && num(t.grace)) things = { grace: t.grace };
  else if (t && 'grave' in t) {
    const g = t.grave && typeof t.grave === 'object' ? (t.grave as Record<string, unknown>) : null;
    things = { grave: g && num(g.x) && num(g.y) ? { x: g.x, y: g.y, n: num(g.n) ? g.n : 0, keeps: num(g.keeps) ? g.keeps : 0 } : null };
  }
  const death: Death = {
    at: Number.isFinite(at) ? at : null, clock: num(o.clock) ? o.clock : null, region: num(o.region) ? o.region : null,
    cause, blows, things,
  };
  return death.at === null && death.clock === null && death.region === null && !cause && !blows.length && !things ? null : death;
}

/** A creature as the card names it: its kind, and its own name where it has one: "Goblin (Grub)". */
const named = (by: string, name: string | null): string => (name ? `${by} (${name})` : by);

/** The cause as the card says it: "Killed by: Goblin", "Bled out: Goblin", "Drowned". */
export function causeSaid(c: DeathCause): string {
  const said = CAUSE_SAID[c.kind];
  return c.by ? `${said}: ${named(c.by, c.name)}` : said;
}

/** A blow as the card lists it: "Killing blow: Goblin · bite · head · 30% health". */
export function blowSaid(b: DeathBlow): string {
  const parts = [named(b.by, b.name)];
  if (b.what) parts.push(WOUND_KINDS[b.what as WoundKind]?.name ?? b.what);
  if (b.part) parts.push(PART_NAMES[b.part] ?? b.part);
  if (b.taken !== null) parts.push(`${percent(Math.round(b.taken * 100) / 100)} health`);
  return `${b.kill ? `${KILLING_BLOW}: ` : ''}${parts.join(' · ')}`;
}

/** A region as the card names it, by the island's number for it (`region_at`); null for one it does not know. */
export function regionSaid(region: number | null): string | null {
  if (region === null) return null;
  if (region === OCEAN_REGION) return SEA_SAID;
  return REGIONS[region]?.name ?? null;
}

/** The island's clock as the hud reads it, "06:30", from its seconds (`Game.clock`). */
export function clockSaid(secs: number): string {
  const h = ((((secs % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS) * 24;
  const m = Math.floor((h % 1) * 60);
  return `${Math.floor(h).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** What became of what was carried, as the card says it; `now` in epoch ms, for how long a grave has left. */
export function thingsSaid(t: DeathThings, at: number | null, now: number): string {
  if ('grace' in t) return graceKeptSaid(t.grace);
  const g = t.grave;
  if (!g) return NOTHING_CARRIED;
  const left = at === null ? g.keeps : g.keeps - (now - at) / 1000;
  return `Grave: ${Math.floor(g.x)}, ${Math.floor(g.y)} · ${g.n} ${g.n === 1 ? 'item' : 'items'} · ${left > 0 ? `crumbles in ${waitWords(left)}` : 'crumbled'}`;
}

/**
 * The card's rows for a body that fell at `fell`, with what the island said of the death (`death`, null from an
 * island before it): the cause, the last blows newest first, where, what became of what was carried, and when.
 */
export function deathRows(fell: { x: number; y: number }, death: Death | null, now = Date.now()): DeathRow[] {
  const rows: DeathRow[] = [];
  if (death?.cause) rows.push({ label: CAUSE_LABEL, lines: [causeSaid(death.cause)] });
  if (death?.blows.length) rows.push({ label: BLOWS_LABEL, lines: death.blows.slice().reverse().map(blowSaid) });
  const region = regionSaid(death?.region ?? null);
  rows.push({ label: WHERE_LABEL, lines: [`${Math.floor(fell.x)}, ${Math.floor(fell.y)}${region ? ` · ${region}` : ''}`] });
  if (death?.things) rows.push({ label: THINGS_LABEL, lines: [thingsSaid(death.things, death.at, now)] });
  const when = [death?.clock != null ? clockSaid(death.clock) : null, death?.at != null ? seasonLine(death.at / 1000) : null].filter(Boolean);
  if (when.length) rows.push({ label: WHEN_LABEL, lines: [when.join(' · ')] });
  return rows;
}
