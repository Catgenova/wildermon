import type { Enchant } from '../game/enchant';
import type { Mark } from '../game/items';

/**
 * Rows of the island's tables as PostgREST sends them: the `world`, `player`
 * and `item` rows the browser reads straight off the tables.
 */

/** A row of the island's `world` table. */
export interface WorldRow {
  id: string;
  name: string;
  seed: number;
  size: number;
  spawn_x: number;
  spawn_y: number;
  epoch: string;
  ready: boolean;
  /** How far the island has let the land's history go: every change up to this one may be gone. */
  changes_from?: number;
}

/** A row of the island's `player` table, with the columns the browser names and the rest by key. */
export interface PlayerRow {
  world_id: string;
  /** Favour banked, as it stood when last settled; your own row only. */
  favour?: number;
  uid: string;
  name: string;
  x: number;
  y: number;
  level: number;
  /** Skin, hair, eyes and clothes, as ids out of `look_option`. */
  look?: unknown;
  /** What they have on, as `rpc_worn` and the body message say it: see `gearFrom`. */
  gear?: unknown;
  act: string | null;
  act_ends: string | null;
  /** The tool the job in hand is done with, as the island took it from their pack: see `toolFrom`. */
  act_tool?: unknown;
  /** When they last took a blow on their shield (`player.blocked_at`), the island's instant; null if never. */
  blocked_at?: string | null;
  /** When a blow last landed on them (`player.hurt_at`), the island's instant, and where (`hurt_where`); null if never. */
  hurt_at?: string | null;
  hurt_where?: string | null;
  /** What struck it, a creature's id: their body broadcast only (their `stats.hurtBy`). */
  hurt_by?: number | null;
  /** Whether that blow was a heavy one (`player.hurt_heavy`): drawn as a stumble back (`src/sculpt/anim/clips/stumble.ts`). */
  hurt_heavy?: boolean | null;
  /** Where they fell, while they may lie there (`player.fell`: `{ x, y, level, at }`, `src/game/fell.ts`); null when not. */
  fell?: unknown;
  [key: string]: unknown;
}

/**
 * A row of the island's `item` table, whole.
 *
 * Named out rather than left to the index signature below, because what this
 * carries is the difference between a thing and the browser's idea of it: the
 * six fields at the top were all that was ever read off one, and the seven
 * under them were dropped on the floor. See `packed` in `play.ts`.
 */
export interface ItemRow {
  id: number;
  def: string;
  ql: number;
  dmg: number;
  count: number;
  extra: string | null;
  holder: string;
  /** Drinks left in a skin, or seconds of candle left as of `lit_at` in a lantern. */
  charges: number | null;
  /** Put by: not to be dropped, eaten, or swallowed by a recipe looking for its kind. */
  locked: boolean;
  /** Handed out rather than made, and so with nothing in it to better. */
  issued: boolean;
  /** 'rare', 'supreme' or 'fantastic'; null for the ordinary run of things. */
  rare: string | null;
  /** The colour it has taken, as a `dye_def` id. */
  dye: string | null;
  /** Circles of cunning worked into it. */
  bless: number | null;
  /** Who made it, for rare work and better. */
  maker: string | null;
  /** The piece a casting is of, for a casting; null for everything else. */
  piece: string | null;
  /** The wildermon shut in it, for a wildermon crate; null for everything else. */
  creature?: number | null;
  /** What its maker's perks put into it: a Carpenter's chest that holds more. Null for most things. */
  mark?: Mark | null;
  /** What is enchanted into it from a scroll (`enchant.ts`). Null for most things. */
  enchant?: Enchant | null;
  /** The line cut into a memorial stone (`memorial.ts`). Null for everything else. */
  engraving?: string | null;
  /** Motes infused into it (`infusion.ts`). Null for most things. */
  infuse?: { el: string; str: number; until: number } | null;
  /** Alight, for the things that burn, and when it was set going. */
  lit: boolean;
  lit_at: string | null;
  /** The bag this is in, when `holder` says 'bag'. */
  inside: number | null;
  /** The tile it lies on, when `holder` says 'ground'. */
  gx: number | null;
  gy: number | null;
  [key: string]: unknown;
}
