import type { DeedRole } from '../game/ranks';
import type { Enchant } from '../game/enchant';
import type { Mark } from '../game/items';
import type { IslandBauble } from '../game/baubles';
import type { BuildingsJSON, Wall } from '../game/building';
import type { Bridge } from '../game/bridges';
import type { Foundation } from '../game/foundations';
import type { WaterPlantKind } from '../world/waterplants';
import type { ItemRow } from './rows';

/**
 * The ground read as the island sends it (`rpc_ground`, `rpc_near`): what is
 * set down, the crates, and the slow half's crops, settlements, buildings and
 * bridges. `Game.sawGround` lays it.
 */

/**
 * A thing the island says is on the ground, as the row comes off `placed`.
 *
 * The row itself, less the columns that are nobody's business — so a column
 * the island learns later arrives here without anybody having to widen a list.
 */
export interface IslandPlaced {
  id: number;
  kind: string;
  sub: string | null;
  x: number;
  y: number;
  /** The storey it stands on: -1 down in a cellar; absent from older islands, and 0 on the ground. */
  level?: number | null;
  sx: number;
  sy: number;
  ql: number | null;
  fuel: number | null;
  ash: number | null;
  /** The enchantment set into it where it stands (`enchanting.ts`), absent for none. */
  enchant?: Enchant | null;
  /** Motes infused into it where it stands (`infusion.ts`), absent for none. */
  infuse?: { el: string; str: number; until: number } | null;
  lit: boolean | null;
  dmg: number | null;
  name: string | null;
  material: string | null;
  /** Which way a piece faces, for furniture; absent from older islands. */
  facing?: string | null;
  /**
   * 'rare', 'supreme' or 'fantastic', for a piece that was one before it was
   * set down; absent from older islands, and null for the rest.
   */
  rare?: string | null;
  litres: number | null;
  liquid: string | null;
  /** Seconds a brew in it still has to work (`ferment_left`), not the whole of its working. */
  ferment: number | null;
  /** For a barrel of wine, when it stops working, in epoch seconds (`ageing.ts`); absent from older islands. */
  aged_from?: number | null;
  /** For a trellis, when its vine was planted and last picked, in epoch seconds (`vineyard.ts`); absent from older islands. */
  vine_at?: number | null;
  picked_at?: number | null;
  bait: string | null;
  bait_ql: number | null;
  caught: number | null;
  /** A furnace's queue and what it has made; a planter's last crop (`sown`), for a Farmer's Crop Rotation. */
  state: { jobs?: unknown[]; output?: unknown[]; sown?: string; skep_at?: number; spring?: boolean } | null;
  mine: boolean;
  /** The padlock fitted to it, by the number it shares with its key. */
  lock?: number | null;
  /** The founder of the settlement it is a store of, when it is marked one (`stores.ts`). */
  store_of?: string | null;
  /** For a wildermon bed, the wildermon asleep in it (`PlacedFurniture.sleeper`). */
  sleeper?: number | null;
  /** Whoever has the reins of it or is sitting in it, by uid. */
  driver?: string | null;
  /** Whether that helm is as good as empty, its holder having gone away; only sent when there is a holder. */
  helm_open?: boolean;
  /** Who is aboard as a passenger and in which place on deck, for a hull that has any; absent when nobody is. */
  riders?: Array<{ uid: string; seat: number }>;
  /** Whoever has a cart by the shafts, by uid. */
  puller?: string | null;
  /** The wildermon shut in it, for a wildermon crate; absent from older islands. */
  creature?: number | null;
  /** What its maker's perks put into it (`Mark`); null for most, and absent from older islands. */
  mark?: Mark | null;
  /** The colour a banner, a flag or a sail was dyed; null undyed, and absent from older islands. */
  dye?: string | null;
  /** The line cut into a memorial stone (`memorial.ts`); null uncut. */
  engraving?: string | null;
  /**
   * When it was set down, in epoch seconds, for a piece with roses or
   * lavender on it (`furniture_def.roses`): what they grow from (`roses.ts`).
   */
  set?: number | null;
  /**
   * What is in it, for a piece of furniture near enough to reach into.
   *
   * Reported as "i opened it and dragged my dirt into it and the dirt
   * vanished". It had not: the island had it in the bin and said so to
   * nobody. Every chest, bin, larder and cart on an island read as empty
   * here, because this read filled `items` with a bare `[]` and nothing ever
   * filled it again — so anything put away went out of the pack and was
   * never seen again. It rides with the row now, the way a crate's contents
   * have since crates crossed, and only within reach, since a yard of full
   * chests is not worth a phone's second.
   */
  things?: StoredThing[];
  /**
   * For a grave: whose it is, by name, and the seconds it has left before it
   * crumbles. What is in it rides in `things`, to its owner only and from
   * within reach; `units`, how many things that is, to its owner from anywhere.
   */
  grave?: { name: string | null; left: number; units?: number | null };
  /**
   * For a piece that gathers moss (a statue), seconds since the moss on it
   * began: since it was set down or last scrubbed, and never from before
   * greening came to the island (`greening.ts`). Absent for everything else.
   */
  green_ago?: number | null;
}

/** A crate, likewise. */
export interface IslandCrate {
  id: number;
  kind: string;
  /** The enchantment set into it where it stands (`enchanting.ts`), absent for none. */
  enchant?: Enchant | null;
  /** Its wear, out of a hundred. */
  dmg?: number | null;
  /** The storey it stands on: -1 down in a cellar; absent from older islands, and 0 on the ground. */
  level?: number | null;
  /** The padlock fitted to it, by the number it shares with its key. */
  lock?: number | null;
  /** The founder of the settlement it is a store of, when it is marked one (`stores.ts`). */
  store_of?: string | null;
  /** Whether it is yours: the island's `crate_yours`. */
  mine?: boolean;
  x: number;
  y: number;
  sx: number;
  sy: number;
  material: string | null;
  /** What it was built at; absent from older islands, where every crate was a 20. */
  ql?: number | null;
  /** 'rare', 'supreme' or 'fantastic'; absent from older islands, null for the rest. */
  rare?: string | null;
  name: string | null;
  deed: boolean;
  /**
   * What is in it, and how much of it.
   *
   * `units` comes for every crate in sight; `things` only for the ones near
   * enough to reach into. The browser used to be told neither, so every crate
   * on an island was drawn empty for ever — which is what "if I put things in
   * the deed crate it automatically puts them back in my inventory" was: the
   * thing went in, the crate never showed it, and the pack settled back to the
   * island's truth a moment later.
   */
  units?: number;
  things?: StoredThing[];
}

/**
 * A thing in a chest, a bin or a crate, as the island sends one: the island's
 * `rpc_ground` and `crates_near`. Its rarity, its colour and its enchantment
 * ride with it, so an enchanted sword put away still reads "(Razoredge)";
 * absent from an island from before they did.
 */
export interface StoredThing {
  id: number;
  def: string;
  ql: number;
  dmg: number;
  count: number;
  extra: string | null;
  /** 'rare', 'supreme' or 'fantastic'; null for the ordinary run of things. */
  rare?: string | null;
  /** The colour it has taken, as a `dye_def` id. */
  dye?: string | null;
  /** What is enchanted into it from a scroll (`enchant.ts`). */
  enchant?: Enchant | null;
  /** For a wildermon crate, the wildermon in it and its name; absent from older islands. */
  creature?: number | null;
  occupant?: string | null;
  /** Its price in silver, on a market stall: what anybody at it sees and buys it for. */
  price?: number | null;
}

/** Everything on the ground within sight, as one answer. */
export interface IslandGround {
  placed: IslandPlaced[];
  crates: IslandCrate[];
  /** The height the ground is being worked to, or null for none. */
  level?: number | null;
  /**
   * What is lying on the ground within range, whole rows, on the fast half.
   * Left out means nothing said; an empty list means nothing is there.
   */
  lying?: ItemRow[];
  /**
   * And what is lying on the floors of the cellars in range, the same way
   * (the rows held as `cellar` on the island): with the fast half, whenever
   * it is sent.
   */
  cellarLying?: ItemRow[];
  /**
   * What is growing, and how far along.
   *
   * `grown` is how far into the stage it is in, in growing seconds on the
   * clock it grows on, rather than the hour the stage began: the island keeps
   * `stage_at` as a timestamp and this browser counts on its own field clock,
   * and a winter between the two readings would put a stage start read as an
   * hour somewhere a field clock never stood. `ago` is the wall seconds since
   * it began, which is all an island from before the year sent.
   */
  crops?: Array<{ x: number; y: number; id: string; stage: number; ago?: number; grown?: number; tended: number; tendedNow: boolean; ql: number; pace?: number; glass?: boolean; hand?: boolean; level?: number; still?: boolean }>;
  /** What grows in the planters within reach, by the planter's id and tile, on the slow half beside `crops`. */
  planted?: Array<{ planter: number; x: number; y: number; id: string; stage: number; ago?: number; grown?: number; tended: number; tendedNow: boolean; ql: number; pace?: number }>;
  /** The island's wall clock as it answered, in epoch seconds: what `wallSkew` is set by. */
  now?: number;
  /**
   * The felling notches near you and how long ago the woods last turned
   * over, both on the slow half. Look reads them: "2 of 3 strokes in it", and
   * "the woods turn over in 9 hours". A browser on an island keeps no clock
   * of its own for the woods, so this is the only place it hears the hour.
   */
  notches?: Array<{ x: number; y: number; cuts: number }>;
  treesAgo?: number;
  /**
   * The water lilies and lotus planted near you, on the slow half: when each
   * was planted and last picked, in seconds of the wall clock -- the same
   * clock both sides read the year off, so what one is doing is worked out
   * here exactly as the island works it out (`waterPlantState`).
   */
  waterPlants?: Array<{ x: number; y: number; kind: WaterPlantKind; at: number; picked: number | null }>;
  /**
   * Your own settlement, on the slow half.
   *
   * Optional, and the three states are three different answers: absent is
   * "this read said nothing about it", null is "you have no settlement" —
   * which is what a disband sends — and an object is the one you have. The
   * fast read carries none of the three, which is why `sawGround` applies it
   * only when it was sent, and why this was wrong to type as always present.
   */
  deed?: { name: string; x: number; y: number; radius: number; level: number; mine: boolean; role?: DeedRole | null; rank?: string | null; perms?: number | null; baubles?: IslandBauble[] | null } | null;
  /**
   * Other people's settlements, and only those near enough to be standing in.
   *
   * Separate from `deed` because the browser does two quite different things
   * with the two. `deed` is yours: `vision.ts` lights it whatever the hour and
   * however far off, `journal.ts` counts it as a stake you planted, `onDeed`
   * decides what you may build. None of that is true of somebody else's, and
   * handing theirs over as `deed` — which is what an island with one
   * settlement in it did — lit their homestead in your fog and ticked their
   * work off in your journal.
   */
  deeds?: Array<{ name: string; x: number; y: number; radius: number; level: number; holder: string | null; mine?: boolean; role?: DeedRole | null; rank?: string | null; perms?: number | null; baubles?: IslandBauble[] | null }>;
  /**
   * Everybody else ashore, with whereabouts while the island is quiet.
   *
   * On the slow half, beside the settlements, because it is the same kind of
   * thing: a fact about the island rather than about the tile you are on.
   * `folk_ashore` decides whether the positions come with it — see
   * `CROWD_HIDES`.
   */
  folk?: Array<{ uid: string; name: string; online: boolean; x?: number; y?: number }>;
  /**
   * Every grave of yours on the island, however far off, on the slow half:
   * what the marks on your map are put down and taken up by. `placed` has
   * only the ones in range, and you wake a long way from where you fell.
   */
  graves?: Array<{ id: number; x: number; y: number }>;
  /**
   * What is standing, and what is half built.
   *
   * The island has kept `building`, `wall` and `floor_tile` since buildings
   * were ported and has never once said a word about them, so on an island a
   * building was invisible to everybody — including whoever planned it. It
   * went up in Postgres, the rules answered about it, and no browser ever drew
   * a wall of it.
   */
  buildings?: BuildingsJSON & { walls: Array<Wall & { greenAgo?: number | null }> };
  /**
   * And the slabs, which are not buildings: a foundation is ground somebody
   * poured, and it is laid beside the terrain rather than inside a house.
   */
  foundations?: Array<Foundation & { greenAgo?: number | null }>;
  nextFoundationId?: number;
  /**
   * The bridges in range, spans and all, on the slow half: shaped as the
   * browser's own. The island has kept them since bridges were ported and
   * said nothing, so on an island a bridge was neither drawn nor walked.
   */
  bridges?: Array<Bridge & { greenAgo?: number | null }>;
  /**
   * Stone that ages (`greening.ts`), on the slow half: the seconds since
   * greening came to this island, and every tile in range paved or scrubbed
   * since, with the seconds since that. A paved tile not in the list began
   * when greening came in. Each wall, slab, bridge and statue carries its own
   * as `greenAgo` (`green_ago` on what is set down): seconds since it began,
   * for the ones that green.
   */
  greenFromAgo?: number;
  paving?: Array<{ x: number; y: number; ago: number }>;
}
