import { TileType, TREE_DATA_LAYOUT } from '../world/tiles';
import type { LandBlob } from '../net/protocol';
import { World } from '../world/world';
import { settingsStored } from './settings';
import { CELLAR_LEVEL, type BuildingsJSON } from './building';
import type { PlacedAnvil } from './anvil';
import type { PlacedCampfire } from './campfire';
import type { PlacedSmelter } from './smelter';
import type { PlacedKiln } from './kiln';
import type { PlacedFurniture } from './furniture';
import type { CountersJSON } from './counters';
import type { PlacedPost } from './posts';
import type { PlacedTrap } from './traps';
import type { Bridge } from './bridges';
import type { SpringSave } from './springs';
import type { Foundation } from './foundations';
import type { Boon } from './boons';
import type { Wound } from './wounds';
import type { Look } from './look';
import type { PathId } from './meditation';
import type { BeltPin } from './belt';
import type { Marker } from './marks';
import type { Hoard } from './treasure';
import type { Nutrient } from './nutrition';
import type { Ledger } from './ledger';
import type { GuideBook } from './guide';
import type { Crop } from './farming';
import type { WaterPlant } from '../world/waterplants';
import type { Swirl } from './motes';
import { upgradeDyes } from './dyestuffs';
import { BUCKET_LITRES } from './furniture';
import { keyX, keyY } from './tileindex';
import type { PlacedCrate } from './crates';
import { renamedKind, type CreatureJSON } from './creatures';
import { chartRegion } from '../world/chart';
import { lairOf, REGIONS } from '../world/regions';
import type { Item } from './items';
import { Game, type Deed } from './game';
import type { GuestSave } from './actor';
import type { Stats } from './player';
import { crateTheKept } from './creaturecrate';

const VERSION = 1;

/** The shape of the land. */
interface GroundBlob {
  heights: Int16Array;
  tiles: Uint8Array;
  data: Uint8Array;
  dirt: Uint8Array;
  rock: Uint8Array;
}

interface SaveData {
  version: number;
  seed: number;
  size: number;
  heights: string;
  tiles: string;
  data: string;
  dirt?: string;
  rock?: string;
  /** The fog of war: what has been seen, and what it looked like. */
  seen?: string;
  mem?: string;
  memData?: string;
  spawn: { x: number; y: number };
  marks?: Marker[];
  /** What is buried, by the map that points at it. */
  hoards?: Hoard[];
  player: { x: number; y: number; name: string; stats: Stats; level?: number; equipped?: Record<string, number | null>; rested?: number; boons?: Boon[]; knacks?: Record<string, number>; nutrition?: Record<Nutrient, number>;
  /** What knacks were called before they were called knacks. */
  affinities?: Record<string, number>; titles?: string[]; title?: string | null; wounds?: Wound[]; nextWound?: number; favour?: number; prayedAt?: number; way?: PathId | null; satAt?: number; usedAt?: Record<string, number>; picks?: string[]; calm?: number;
  satSpots?: Array<[number, number]>; satDawn?: number; foreknow?: number; clarityUntil?: number; studied?: Record<string, number>; pathTimes?: Record<string, number>; belt?: Array<BeltPin | null>; look?: Look };
  inventory: Item[];
  nextUid?: number;
  ground?: Record<string, Item[]>;
  /** What lies on the floors of cellars, by tile; a save from before there were cellars has none. */
  cellarGround?: Record<string, Item[]>;
  skills: Record<string, number>;
  time: number;
  /** When the woods were last turned over, in real seconds. */
  treesAt?: number;
  /** When greening came in, and each tile paved since, as [x, y, when it was paved or scrubbed]. See `greening.ts`. */
  greenFrom?: number;
  pavingSince?: Array<[number, number, number]>;
  /**
   * Which layout the tree bytes were written under, and the felling notches
   * as [x, y, cuts]. A save from before `TREE_DATA_LAYOUT` was 2 kept the
   * notch in the byte's top two bits; those are cleared on the way in, and a
   * half-felled tree, once, is the one thing such a save loses.
   */
  trees?: number;
  notches?: Array<[number, number, number]>;
  /** The wear feet have put on the ground, as [x, y, wear] (`World.wear`). A save from before it has none. */
  wear?: Array<[number, number, number]>;
  settings: { grid: boolean; rotation?: number; eighths?: number; deedBorder?: boolean; cutaway?: boolean; tileWindow?: boolean; fog?: boolean; follow?: boolean; edgePan?: boolean };
  savedAt: number;
  deed?: Deed | null;
  buildings?: BuildingsJSON;
  creatures?: { nextId: number; list: CreatureJSON[]; banked?: Array<[number, number]> };
  crates?: PlacedCrate[];
  campfires?: PlacedCampfire[];
  smelters?: PlacedSmelter[];
  kilns?: PlacedKiln[];
  furniture?: PlacedFurniture[];
  posts?: PlacedPost[];
  traps?: PlacedTrap[];
  nextTrapId?: number;
  bridges?: Bridge[];
  nextBridgeId?: number;
  springs?: SpringSave[];
  foundations?: Foundation[];
  nextFoundationId?: number;
  tally?: Record<string, number>;
  ledger?: Ledger;
  ticked?: string[];
  /** The field guide: the kinds seen, tamed and bred. A save from before it has none, and starts an empty book. */
  guide?: GuideBook;
  anvils?: PlacedAnvil[];
  crops?: Crop[];
  /** The crop last sown on each field, as `[x, y, crop]`. A save from before it has none. */
  sown?: Array<[number, number, string]>;
  /** What grows in planters, each with its planter's id. A save from before planters grew anything has none. */
  planted?: Crop[];
  /** The field clock (`Game.fieldTime`). A save from before the year has none, and starts it at the game clock. */
  fieldTime?: number;
  /** And a Season's Hand's (`Game.handTime`). */
  handTime?: number;
  /** The water lilies and lotus planted here. A save from before them has none. */
  waterPlants?: WaterPlant[];
  /** The day's mote swirls and the dawn they were put down for. A save from before them has none, and is given the day's. */
  swirls?: Swirl[];
  swirlDawn?: number;
  /** What is set out on each shop counter. A save from before counters has none. */
  counters?: CountersJSON;
  crate?: { x: number; y: number; items: Item[] } | null;
  /**
   * Everybody who has ever visited, and what they had when they left.
   *
   * A host's save is the island's memory, and its guests are part of the
   * island. Without this, somebody who spent an evening here came back the
   * next night to empty hands and no skills, because the only place their
   * evening was written down was a map in the tab that had since been closed.
   */
  guests?: GuestSave[];
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Everything about a world except the land itself. */
type SaveMeta = Omit<SaveData, 'heights' | 'tiles' | 'data' | 'dirt' | 'rock' | 'seen' | 'mem' | 'memData'>;

function meta(game: Game): SaveMeta {
  const w = game.world;
  return {
    version: VERSION,
    seed: game.seed,
    size: w.w,
    spawn: game.spawn,
    marks: game.marks,
    hoards: game.hoards,
    player: { x: game.player.x, y: game.player.y, name: game.player.name, look: game.player.look, stats: game.player.stats, level: game.player.level, equipped: game.player.equipped, rested: game.player.rested, boons: game.player.boons, knacks: game.player.knacks, nutrition: game.player.nutrition, titles: game.player.titles, title: game.player.title, wounds: game.player.wounds, nextWound: game.player.nextWound, favour: game.player.favour, prayedAt: game.player.prayedAt, way: game.player.way, satAt: game.player.satAt, usedAt: game.player.usedAt, picks: game.player.picks, calm: game.player.calm, satSpots: game.player.satSpots, satDawn: game.player.satDawn, foreknow: game.player.foreknow, clarityUntil: game.player.clarityUntil, studied: game.player.studied, pathTimes: game.player.pathTimes, belt: game.player.belt },
    inventory: game.inventory.items,
    nextUid: game.inventory.nextUid,
    ground: game.groundToJSON(),
    cellarGround: game.groundToJSON(CELLAR_LEVEL),
    skills: game.skills.toJSON(),
    time: game.time,
    treesAt: game.treesAt,
    greenFrom: game.greenFrom,
    pavingSince: [...game.pavingSince].map(([at, since]) => {
      const [x, y] = at.split(',').map(Number);
      return [x, y, since] as [number, number, number];
    }),
    trees: TREE_DATA_LAYOUT,
    notches: [...w.notches].map(([at, cuts]) => {
      const [x, y] = at.split(',').map(Number);
      return [x, y, cuts] as [number, number, number];
    }),
    wear: [...w.wear].map(([i, v]) => [i % w.w, Math.floor(i / w.w), v] as [number, number, number]),
    // The view used to turn in quarters and now turns in eighths. Written
    // under a name that says which, so a save from before is still read as
    // the angle it was left at rather than half of it.
    settings: { ...game.settings, rotation: undefined, eighths: game.settings.rotation },
    savedAt: Date.now(),
    deed: game.deed,
    buildings: game.buildings.toJSON(),
    creatures: game.creatures.toJSON(),
    crates: [...game.crates.values()],
    campfires: [...game.campfires.values()],
    smelters: [...game.smelters.values()],
    kilns: [...game.kilns.values()],
    furniture: [...game.furniture.values()],
    posts: [...game.posts.values()],
    traps: [...game.traps.values()],
    nextTrapId: game.nextTrapId,
    bridges: [...game.bridges.values()],
    nextBridgeId: game.nextBridgeId,
    springs: game.springs.toJSON(),
    foundations: [...game.foundations.values()],
    nextFoundationId: game.nextFoundationId,
    tally: { ...game.tally },
    ledger: { ...game.ledger },
    ticked: [...game.ticked],
    guide: game.guide.toJSON(),
    anvils: [...game.anvils.values()],
    crops: [...game.crops.values()],
    sown: [...game.sown].map(([k, id]): [number, number, string] => [keyX(k), keyY(k), id]),
    planted: [...game.planted.values()],
    fieldTime: game.fieldTime,
    handTime: game.handTime,
    waterPlants: [...game.waterPlants.values()],
    swirls: game.swirlDawn === null ? undefined : [...game.swirls.values()],
    swirlDawn: game.swirlDawn ?? undefined,
    counters: game.counters.toJSON(),
    guests: game.guestRecords(),
  };
}

/** The land as it stands, ready to be put away as it is. */
function ground(game: Game): GroundBlob {
  const w = game.world;
  return { heights: w.heights, tiles: w.tiles, data: w.data, dirt: w.dirt, rock: w.rock };
}

/**
 * Turn a world and its papers into a game, whichever place they came from.
 * Everything here is the passage of time and the mending of old saves: what
 * rotted while you were away, tools a world was made before, and settings that
 * did not exist when it was written down.
 */
function finish(world: World, m: SaveMeta): Game {
  // Dye from before it was mixed: what was dyed keeps its colour, and a pot of it is a bucket of the nearest mix (`upgradeDyes`).
  upgradeDyes(m as unknown as Record<string, unknown>, BUCKET_LITRES);
  // Tree bytes from before the age had all four bits carry the notch in the
  // top two, which would read as ages that do not exist.
  if (m.trees !== TREE_DATA_LAYOUT) {
    for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === TileType.Tree) world.data[i] &= 63;
  }
  // And ground paved before gravel was retired. Thirteen was gravel and is
  // nothing now; what it was for, cobblestone does properly and for the same
  // handful of shards, so that is what it becomes.
  for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 13) world.tiles[i] = TileType.Cobblestone;
  for (const [x, y, cuts] of m.notches ?? []) world.setNotch(x, y, cuts);
  for (const [x, y, v] of m.wear ?? []) if (world.inBounds(x, y) && v > 0) world.wear.set(y * world.w + x, v);
  const game = new Game({
    seed: m.seed,
    world,
    treesAt: m.treesAt,
    greenFrom: m.greenFrom,
    pavingSince: m.pavingSince,
    spawn: m.spawn,
    player: m.player,
    inventory: m.inventory,
    nextUid: m.nextUid,
    ground: m.ground,
    cellarGround: m.cellarGround,
    skills: m.skills,
    time: m.time,
    deed: m.deed ?? null,
    buildings: m.buildings,
    creatures: m.creatures,
    crates: m.crates,
    campfires: m.campfires,
    smelters: m.smelters,
    kilns: m.kilns,
    furniture: m.furniture,
    posts: m.posts,
    traps: m.traps,
    nextTrapId: m.nextTrapId,
    bridges: m.bridges,
    nextBridgeId: m.nextBridgeId,
    springs: m.springs,
    foundations: m.foundations,
    nextFoundationId: m.nextFoundationId,
    tally: m.tally,
    ledger: m.ledger,
    ticked: m.ticked,
    guide: m.guide,
    anvils: m.anvils,
    crops: m.crops,
    sown: m.sown,
    planted: m.planted,
    fieldTime: m.fieldTime,
    handTime: m.handTime,
    waterPlants: m.waterPlants,
    swirls: m.swirls,
    swirlDawn: m.swirlDawn,
    counters: m.counters,
    marks: m.marks,
    hoards: m.hoards,
    crate: m.crate ?? null,
    guests: m.guests,
  });
  // Aboard as a passenger when it was saved: the hull's list of who is aboard
  // is what was kept, so the body's place is read back off it.
  for (const f of game.furniture.values()) {
    const mine = (f.riders ?? []).find((r) => r.who === game.riderId());
    if (mine) {
      game.player.aboard = f.id;
      game.player.seat = mine.seat;
    }
  }
  // Whatever the save had, the island is brought up to the wildlife it should
  // hold. Species no longer need seeding one at a time: what is let out of the
  // bank is rolled from the whole table, so every one of them turns up.
  game.creatures.stockIsland(game);
  // The settlement deed form became a carved stake, mosaic stained glass, the
  // altar's mote a soul, a restored bone comb an ancient comb and a restored
  // old lamp an ancient lamp; rename them wherever they sit.
  const RENAMED: Record<string, string> = { settlement_deed: 'deed_stake', mosaic_tile: 'stained_glass_pane', mote: 'soul', bone_comb: 'ancient_comb', old_lamp: 'ancient_lamp' };
  const restake = (items: Item[] | undefined): void => {
    for (const it of items ?? []) {
      it.id = RENAMED[it.id] ?? it.id;
      if (it.inside) restake(it.inside);
    }
  };
  restake(game.inventory.items);
  for (const pile of game.ground.values()) restake(pile);
  for (const pile of game.cellarGround.values()) restake(pile);
  for (const crate of game.crates.values()) restake(crate.items);
  for (const piece of game.furniture.values()) restake(piece.items);
  for (const counter of game.counters.list.values()) restake(counter.items);
  for (const oven of [...game.kilns.values(), ...game.smelters.values()]) restake(oven.output);
  for (const c of game.creatures.list.values()) {
    restake(c.pannier);
    if (c.carrying) restake([c.carrying]);
    if (c.laden) restake(c.laden);
  }
  const rekey = (rec: Record<string, unknown>): void => {
    for (const [was, now] of Object.entries(RENAMED)) if (was in rec) { rec[now] = rec[was]; delete rec[was]; }
  };
  rekey(game.ledger);
  // And a wildermon nobody has named is called what its kind is called at the stage it is at, old names and all (`renamedKind`).
  for (const c of game.creatures.list.values()) c.name = renamedKind(c);
  // And a wild monster kept to one island (`Region.lair`) that stood up on another before it was kept there is gone, as
  // the island's wild dragons off Volcano Isle went. One in a trap is the trap's.
  for (const c of [...game.creatures.list.values()]) {
    const lair = lairOf(c.species);
    if (lair && c.mode === 'wild' && c.trapped === null && REGIONS[chartRegion(c.x, c.y, game.world.w)] !== lair) game.creatures.remove(c.id);
  }
  for (const part of [...game.buildings.walls.values(), ...game.buildings.floors.values(), ...game.buildings.columns.values()]) {
    if (part.material === 'mosaic') part.material = 'stained_glass';
    rekey(part.needed);
    rekey(part.total);
  }
  if (game.deed && !game.deedCrate()) game.placeDeedCrate();
  // Nothing is kept at the token any more: what was, is put in creature crates.
  const crated = crateTheKept(game);
  if (crated) {
    game.logMsg(`Wildermon are no longer kept at the token. ${crated === 1 ? 'The one you kept there is' : `The ${crated} you kept there are`} each in a creature crate now${game.deed ? `, set down near the token of ${game.deed.name} where there was room and otherwise in your pack` : ', in your pack'}. Open a crate to have one follow you or work the deed.`, 'system');
  }
  /*
   * And the settings, only if this browser has never put any away.
   *
   * They live in `localStorage` now, beside the keys and the window layout,
   * because they are a fact about the person rather than about the island —
   * and because an island session never saves at all, so riding the save meant
   * resetting on every refresh for everybody playing on one.
   *
   * A save that predates that move still carries them, and a solo player who
   * has been playing for a week should not have their view reset by the
   * upgrade. So the save seeds them once, through the proxy, which puts them
   * away; after that the store is the authority and this is skipped. Without
   * the guard a change made in the twenty seconds before a save would be
   * reverted by the save on the next refresh.
   */
  if (!settingsStored()) {
    game.settings.grid = m.settings?.grid ?? true;
    game.settings.rotation = (m.settings?.eighths ?? (m.settings?.rotation ?? 0) * 2) & 7;
    game.settings.deedBorder = m.settings?.deedBorder ?? true;
    game.settings.cutaway = m.settings?.cutaway ?? false;
    game.settings.tileWindow = m.settings?.tileWindow ?? true;
    game.settings.fog = m.settings?.fog ?? true;
    game.settings.follow = m.settings?.follow ?? true;
    game.settings.edgePan = m.settings?.edgePan ?? true;
  }
  game.logMsg('Resumed where you left off.', 'system');
  // Older saves predate building: hand out the tools they never got.
  const granted: string[] = [];
  for (const [id, name] of [
    ['mallet', 'a mallet'],
    ['trowel', 'a trowel'],
    ['saw', 'a saw'],
    ['butchering_knife', 'a butchering knife'],
    ['rake', 'a rake'],
  ]) {
    if (!game.inventory.has(id)) {
      // Handed out, like the rest of the kit, and no more improvable for it.
      game.inventory.add(id, { ql: 20, issued: true });
      granted.push(name);
    }
  }
  if (granted.length) game.logMsg(`Added to your pack: ${granted.join(', ')}.`, 'system');
  // Things left outside kept rotting while you were away, up to a week's worth.
  const away = Math.max(0, Math.min(7 * 86400, (Date.now() - (m.savedAt ?? Date.now())) / 1000));
  if (away > 60 && game.ground.size) {
    const lost = game.applyDecay(away);
    if (lost) game.logMsg(`While away: ${lost} ${lost === 1 ? 'item' : 'items'} on the ground rotted away.`, 'event');
  }
  return game;
}

/**
 * The island packed up for somebody else's machine.
 *
 * A join is a save that travels. The two halves are exactly the save's own:
 * the **land**, which is big and identical for everyone, and the **world**,
 * which is everything else the save writes down. The fog does not go — what
 * one person has walked is theirs, and a newcomer should arrive to a dark map
 * and light it themselves.
 *
 * The world half still carries the host's own body and pack, since it is the
 * save's own metadata and that is what a save writes down. A guest does not
 * keep them: the moment they say who they are, their real pack is sent after
 * the welcome and lands on top. What does not go at all is the guest book —
 * everybody else's belongings are nobody's business but the island's.
 */
export async function packLand(game: Game): Promise<LandBlob> {
  const g = ground(game);
  const heights = new Uint8Array(g.heights.buffer, g.heights.byteOffset, g.heights.byteLength);
  const [h, t, d, dirt, rock] = await Promise.all([squash(heights), squash(g.tiles), squash(g.data), squash(g.dirt), squash(g.rock)]);
  return { size: game.world.w, zip: canZip(), heights: h, tiles: t, data: d, dirt, rock };
}

/** Whether this browser will gzip for us. Every current one will; none is required to. */
const canZip = (): boolean => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** Bytes to a string, squeezed on the way if the browser can squeeze. */
async function squash(bytes: Uint8Array): Promise<string> {
  if (!canZip()) return toBase64(bytes);
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream('gzip'));
  return toBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** And back again. */
async function swell(s: string, zipped: boolean): Promise<Uint8Array> {
  const raw = fromBase64(s);
  if (!zipped) return raw;
  const stream = new Blob([raw.slice()]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Everything about the island except the land itself and who has seen what.
 *
 * The guest book stays behind. It is the host's record of other people's
 * packs, it grows with every visitor the island ever has, and nobody arriving
 * needs to turn up holding everyone else's belongings. What a guest is owed of
 * it comes back to them alone, in their own pack, once they have said who they
 * are.
 */
export function packWorld(game: Game): unknown {
  const { guests: _guests, ...rest } = meta(game);
  return rest;
}

/**
 * Unpack an island somebody else sent, into a game that can be played and
 * drawn. It goes through exactly the same door a load from the store goes
 * through, so a world that arrives over a wire is a world of the same kind as
 * one that comes off a disk — there is no second, thinner sort of game.
 */
export async function unpack(land: LandBlob, packed: unknown): Promise<Game | null> {
  const m = packed as SaveMeta | null;
  if (!m || typeof m !== 'object' || typeof m.seed !== 'number') return null;
  const size = land.size;
  if (!Number.isInteger(size) || size < 8 || size > 4096) return null;
  try {
    const zipped = land.zip !== false;
    const [heightBytes, tiles, data, dirt, rock] = await Promise.all([
      swell(land.heights, zipped),
      swell(land.tiles, zipped),
      swell(land.data, zipped),
      swell(land.dirt, zipped),
      swell(land.rock, zipped),
    ]);
    const heights = new Int16Array(heightBytes.buffer, heightBytes.byteOffset, (size + 1) * (size + 1));
    const world = new World(size, size, heights, tiles, data, dirt, rock);
    world.seed = m.seed;
    // The papers as sent, with nothing of this machine's own laid over them:
    // `patched` is the last-moment note a closing tab leaves about **its**
    // world, and an island that arrived over a wire is not that world however
    // well the two happen to match.
    //
    // A guest arrives to a dark island and lights it by walking it.
    return finish(world, m);
  } catch {
    return null;
  }
}

