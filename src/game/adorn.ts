/**
 * The adornments (`adorndefs.ts` holds their numbers): a lily pond, an ivy
 * wall panel, a garden obelisk, a herb spiral, a buoy, a cauldron hearth, a
 * cheese rack, a pelt rug, a plush wildermon, a game table, a gem lamp, a
 * pedigree board and a worker nameplate; and the garden footbridge, which is
 * a bridge kind (`bridges.ts`). The island does every job (`adorn_refusal`,
 * `perform_adorn`); what is here says the same refusals in the same order,
 * names the menus, and reads what the island keeps.
 *
 * What the island keeps of a piece is in `placed.garden` (and `item.garden`
 * in the pack), sent to every browser with the ground read:
 *
 *   lilies  water lily roots planted in a lily pond;
 *   pea     the colour an obelisk's sweet peas are chosen in (unsaid: the season's);
 *   herbs   a herb spiral's slots: `[crop, sown]` each (epoch seconds), null for one not sown;
 *   cheese  the cheeses on a rack: `[ql, at]` each, the QL it went up at and when (epoch seconds);
 *   plush   the kind a plush is sewn as, chosen at the needle;
 *   round   a game table's round of stones: `a`, `an`, `as` (the first player, their name and points), `b`, `bn`, `bs`, and `last` to throw;
 *   wins    a game table's tally: `[uid, name, wins]` each;
 *   tree    a pedigree board's wildermon and its line: `id`, and `n` (name), `k` (kind), `d` (dam) and `s` (sire), two generations up;
 *   plate   a nameplate's QL, on a wildermon bed.
 *
 * A buoy's name is the placed row's `engraving`, as a cairn's. A pelt rug's
 * kind and a gem lamp's gem are its `material`, off the first thing it is
 * made of (`Recipe.material`: `pelt`, `gem`). Fur carries the kind it came
 * off as its label from the butchering (`item.extra`).
 */
import type { ActionDef, Target } from './actions';
import {
  ADORN_TIME, BUOY, BUOY_REACH, CAULDRON_HEARTH, CAULDRON_SERVINGS, CHEESE, CHEESE_AGEING, CHEESE_RACK, GAME_TABLE, GARDEN_OBELISK, GEM_LAMP, GEM_LAMP_REACH, HERB_SPIRAL,
  IVY_CUTTING, IVY_CUTTINGS, IVY_PANEL, IVY_PANEL_DAYS, LILY_POND, LINEAGE_TIME, NAMEPLATE, PEA_BY_SEASON, PEA_COLOURS, PEDIGREE_BOARD, PELT_RUG, PLUSH, POND_LILIES, RACK_HOLDS,
  PLUSH_SAID, SPIRAL_PICK, SPIRAL_SLOTS, STONES_GOAL, STONES_LEAST, STONES_SIDES, TABLE_SEATS, THROW_TIME,
} from './adorndefs';
import { denStage, furnitureCentre, furnitureDef, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { lampTooFar, LAMP_CAST, LAMP_CAST_ALPHA, LAMP_STRENGTH } from './lamps';
import type { LightSource } from './light';
import { STATE_TAILS } from './pieceTails';
import { capital, listed, listedOr } from './words';
import { CROP_LIST, RIPE, type CropDef } from './farming';
import { fieldClock } from './growth';
import { ageGain, CELLAR_AGEING } from './ageing';
import { creatureLevel, kindName, kindNameOf, SPECIES, type Creature } from './creatures';
import { cleanLine } from './chat';
import { CAIRN_NAME_MAX, CAIRN_NAME_TIME } from './furnishdefs';
import { FURNISH_SAID } from './furnish';
import { seasonAt } from '../world/calendar';
import { WATERSIDE_FINDS } from './forage';
import { SWEET_PEA_RULE } from './roses';
import { POT_DISHES } from './recipes';
import { GEMS } from './gems';

const wordOf = (id: string): string => (itemDef(id)?.name ?? id).toLowerCase();
const nameOf = (kind: string): string => furnitureDef(kind).name.toLowerCase();
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---- what the island keeps --------------------------------------------------------------- */

/** One wildermon on a pedigree board: its name and its kind, and its dam and sire as far as they are known. */
export interface Lineage { n: string; k?: string; d?: Lineage; s?: Lineage }
/** A round of stones at a game table. */
export interface Round { a: string; an: string; as: number; b?: string; bn?: string; bs?: number; last: string }

/** What an adornment holds and how it stands (`placed.garden`). */
export interface AdornState {
  lilies?: number;
  pea?: string;
  herbs?: Array<[string, number] | null>;
  cheese?: Array<[number, number]>;
  plush?: string;
  round?: Round;
  wins?: Array<[string, string, number]>;
  tree?: Lineage & { id: number };
  plate?: number;
}

const lineageFrom = (raw: unknown, depth: number): Lineage | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.n)) return undefined;
  const out: Lineage = { n: r.n };
  if (isStr(r.k)) out.k = r.k;
  if (depth > 0) {
    const d = lineageFrom(r.d, depth - 1), s = lineageFrom(r.s, depth - 1);
    if (d) out.d = d;
    if (s) out.s = s;
  }
  return out;
};

/** The island's `garden` as this side keeps it for the adornments, or undefined for none: only what is well formed. */
export function adornFrom(raw: unknown): AdornState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: AdornState = {};
  if (isNum(r.lilies) && r.lilies > 0) out.lilies = Math.min(POND_LILIES, r.lilies);
  if (isStr(r.pea) && PEA_COLOURS[r.pea]) out.pea = r.pea;
  if (Array.isArray(r.herbs)) {
    out.herbs = Array.from({ length: SPIRAL_SLOTS }, (_, i) => {
      const h = (r.herbs as unknown[])[i];
      return Array.isArray(h) && isStr(h[0]) && isNum(h[1]) && SPIRAL_HERBS.some((c) => c.id === h[0]) ? [h[0], h[1]] as [string, number] : null;
    });
  }
  if (Array.isArray(r.cheese)) {
    out.cheese = r.cheese.filter((c): c is unknown[] => Array.isArray(c) && isNum(c[0]) && isNum(c[1])).slice(0, RACK_HOLDS).map((c) => [c[0] as number, c[1] as number]);
  }
  if (isStr(r.plush)) out.plush = r.plush;
  const rd = r.round as Record<string, unknown> | undefined;
  if (rd && typeof rd === 'object' && isStr(rd.a) && isStr(rd.an) && isNum(rd.as) && isStr(rd.last)) {
    out.round = { a: rd.a, an: rd.an, as: rd.as, last: rd.last, ...(isStr(rd.b) && isStr(rd.bn) && isNum(rd.bs) ? { b: rd.b, bn: rd.bn, bs: rd.bs } : {}) };
  }
  if (Array.isArray(r.wins)) {
    out.wins = r.wins.filter((w): w is unknown[] => Array.isArray(w) && isStr(w[0]) && isStr(w[1]) && isNum(w[2])).map((w) => [w[0] as string, w[1] as string, w[2] as number]);
  }
  const tr = r.tree as Record<string, unknown> | undefined;
  const tree = lineageFrom(tr, 2);
  if (tree && isNum(tr?.id)) out.tree = { ...tree, id: tr.id };
  if (isNum(r.plate)) out.plate = r.plate;
  return Object.keys(out).length ? out : undefined;
}

/* ---- a lily pond ----------------------------------------------------------------------------- */

/** Whether a lily pond stands on tile (x, y) or a tile beside it, as water would for the shore (`atWaterEdge`): what botanizing there finds. The island's `pond_near`. */
export function pondNear(g: Game, x: number, y: number): boolean {
  for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
    if (g.furnitureOnTile(x + dx, y + dy).some((f) => f.kind === LILY_POND && (f.level ?? 0) === 0)) return true;
  }
  return false;
}
/** Lily roots in a pond. */
export const liliesIn = (f: { adorn?: AdornState }): number => f.adorn?.lilies ?? 0;

/* ---- an ivy wall panel ------------------------------------------------------------------------ */

// Its ivy's days, and the wall it hangs on, live with the ivy (`greening.ts`).
export { panelGreenDays, panelOn } from './greening';

/* ---- a buoy and a gem lamp: their light ------------------------------------------------------ */

/** A buoy's light at night: `BUOY_REACH` tiles, a lantern's warmth. */
export function buoyLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: BUOY_REACH, strength: LAMP_STRENGTH, steady: true, cast: LAMP_CAST, castAlpha: LAMP_CAST_ALPHA };
}
/** A gem's glow as 'r, g, b', by its name: set by the renderer, which holds the stones' colours (`gemTone`). */
export const GEM_CAST: { of: (gem: string | undefined) => string | undefined } = { of: () => undefined };
/** How strong a gem lamp's colour is at its middle at full dark: a lantern's twice over, a gem's light being all colour. */
export const GEM_CAST_ALPHA = LAMP_CAST_ALPHA * 2;
/** A gem lamp's light at night: `GEM_LAMP_REACH` tiles, in its gem's colour. */
export function gemLampLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: GEM_LAMP_REACH, strength: LAMP_STRENGTH, steady: true, cast: GEM_CAST.of(f.material) ?? LAMP_CAST, castAlpha: GEM_CAST_ALPHA };
}

/* ---- a garden obelisk ------------------------------------------------------------------------ */

/** The colour an obelisk's sweet peas flower in now: the one chosen, else the season's, else the first. */
export const peaColour = (f: { adorn?: AdornState }, now: number): string =>
  f.adorn?.pea ?? PEA_BY_SEASON[seasonAt(now).season] ?? Object.keys(PEA_COLOURS)[0];
export const PEA_NAMES: readonly string[] = Object.keys(PEA_COLOURS);

/* ---- a herb spiral --------------------------------------------------------------------------- */

/** What a spiral grows: the herbs (`CropDef.kind` spice), each from its seed. */
export const SPIRAL_HERBS: readonly CropDef[] = CROP_LIST.filter((c) => c.kind === 'spice');
export const SPIRAL_SEEDS: readonly string[] = SPIRAL_HERBS.map((c) => c.seed);
export const SLOTS: readonly number[] = Array.from({ length: SPIRAL_SLOTS }, (_, i) => i);
/** A slot's growing seconds to ripe: its herb's stages from sown to ripe (`RIPE` of them), on the field clock (`fieldClock`: by the seasons, none in winter). */
export const slotGrows = (crop: CropDef): number => RIPE * crop.stageSeconds;
/** Whether a slot sown at `sown` is ripe at `now` (epoch seconds): its growing seconds on the field clock. The island's `slot_ripe`. */
export const slotRipe = (crop: CropDef, sown: number, now: number): boolean => fieldClock(now) - fieldClock(sown) >= slotGrows(crop);
/** How far a slot has grown, nought to one, for the drawing. */
export const slotGrown = (crop: CropDef, sown: number, now: number): number => Math.max(0, Math.min(1, (fieldClock(now) - fieldClock(sown)) / slotGrows(crop)));
const cropOf = (id: string): CropDef | undefined => SPIRAL_HERBS.find((c) => c.id === id);

/* ---- a cheese rack --------------------------------------------------------------------------- */

/** A cheese's QL on a rack after `secs` there, by the wine rule (`ageGain`): `CHEESE_AGEING` a day, `CELLAR_AGEING` times in a cellar, to its cap. The island's `age_gain('cheese', ...)`. */
export const rackQl = (ql: number, secs: number, cellar: boolean): number => Math.min(100, ql + ageGain(CHEESE, secs, cellar));
/** Cheeses on a rack. */
export const cheeseOn = (f: { adorn?: AdornState }): number => f.adorn?.cheese?.length ?? 0;
/** The cheese stack in the pack a Put on the rack would take from: the one named, or the first. */
export function toRack(g: Game, t: Target): Item | undefined {
  const uid = (t as { itemUid?: number }).itemUid;
  if (uid !== undefined) return g.inventory.get(uid);
  return g.inventory.items.find((it) => it.id === CHEESE && !it.locked);
}

/* ---- a pelt rug and a plush ------------------------------------------------------------------ */

/** The kind a pelt rug was made of, off its material (a kind's name, as fur is labelled): its id, or undefined. */
export const peltKind = (material: string | undefined): string | undefined =>
  (material ? Object.values(SPECIES).find((s) => s.name.toLowerCase() === material.toLowerCase())?.id : undefined);
/** A pelt's colours, its kind's first coat: body and belly (`SpeciesDef.variants`). */
export const peltColours = (material: string | undefined): [string, string] | undefined => {
  const k = peltKind(material);
  return k ? SPECIES[k].variants[0] : undefined;
};
export { plushRefusal, PLUSH_SAID } from './adorndefs';

/* ---- a game table ---------------------------------------------------------------------------- */

/** A table's tally of wins, most first. */
export const winsOf = (f: { adorn?: AdornState }): Array<[string, string, number]> => [...(f.adorn?.wins ?? [])].sort((a, b) => b[2] - a[2] || (a[1] < b[1] ? -1 : 1));
/** Who throws next in a round, by name: whoever did not throw last, or anybody but them while only one has. */
export const nextThrower = (r: Round): string | null => (r.b ? (r.last === r.a ? r.bn ?? null : r.an) : null);

/* ---- a pedigree board ------------------------------------------------------------------------ */

/** One wildermon of a line, as the board says it: "Snow (wolfling)". */
export const lineWords = (l: Lineage | undefined): string => (l ? `${l.n}${l.k ? ` (${kindNameOf(l.k).toLowerCase()})` : ''}` : 'unknown');
/** A board's lines, generation by generation: the wildermon, its dam and sire, theirs. */
export function lineageLines(t: Lineage | undefined): string[] {
  if (!t) return [];
  return [
    lineWords(t),
    `Dam: ${lineWords(t.d)}; sire: ${lineWords(t.s)}`,
    `Dam's dam: ${lineWords(t.d?.d)}; dam's sire: ${lineWords(t.d?.s)}`,
    `Sire's dam: ${lineWords(t.s?.d)}; sire's sire: ${lineWords(t.s?.s)}`,
  ];
}

/* ---- a worker nameplate ---------------------------------------------------------------------- */

/** Whether a piece is a wildermon bed a nameplate hangs on. */
export const isDenBed = (kind: string): boolean => denStage(kind) !== undefined;
/** The worker a bed's nameplate names: whoever sleeps in it, else whoever is on the way to it (`Creature.bed`). */
export function plateWorker(g: Game, f: PlacedFurniture): Creature | undefined {
  if (f.sleeper !== undefined) {
    const c = g.creatures.list.get(f.sleeper);
    if (c) return c;
  }
  for (const c of g.creatures.list.values()) if (c.bed === f.id) return c;
  return undefined;
}
/** What a nameplate shows: "Snow · Wolfling · level 12", or nobody. */
export const plateWords = (c: Creature | undefined): string => (c ? `${c.name} · ${kindName(c)} · level ${creatureLevel(c)}` : 'no worker');

/* ---- the words --------------------------------------------------------------------------- */

const HERB_WORDS = (): string => listedOr(SPIRAL_SEEDS.map(wordOf));
/** Every refusal, in the island's words (`adorn_said`): `{name}` the piece's name, `{n}` a count, `{what}` a thing. */
export const ADORN_SAID = {
  notYours: 'Not yours: {name}.',
  pondFull: `Lily pond: full, ${POND_LILIES} lilies.`,
  noLily: `Need a ${wordOf('lily_root')}.`,
  samePea: 'Already {what}.',
  noSlot: 'Choose a slot.',
  slotSown: 'Slot {n}: already sown.',
  get noSeed(): string { return `Need a herb seed: ${HERB_WORDS()}.`; },
  notSeed: 'Herb seeds only.',
  slotEmpty: 'Slot {n}: nothing sown.',
  notRipe: 'Slot {n}: not ripe.',
  notWater: 'On water only.',
  rackFull: `Cheese rack: full, ${RACK_HOLDS} cheeses.`,
  noCheese: 'Need a cheese.',
  notCheese: 'Cheese rack: cheese only.',
  rackEmpty: 'No cheese on it.',
  pickKind: PLUSH_SAID.pick,
  untamed: PLUSH_SAID.untamed,
  roundOn: 'Round on: {what}.',
  notTurn: 'Not your turn: {what} throws next.',
  noOpponent: `Needs a second player seated at it or beside it.`,
  boardNotYours: 'Only whoever set it down may choose.',
  pickCreature: 'Choose a wildermon.',
  notKept: 'Not one of yours.',
  sameCreature: 'Already {what}.',
  noLine: 'No wildermon chosen.',
  plateOn: 'Nameplate already on it.',
  noPlate: `Need a ${wordOf(NAMEPLATE)}.`,
  noPlateOn: 'No nameplate on it.',
};
export type AdornSaid = keyof typeof ADORN_SAID;
export const adornSaid = (key: AdornSaid, f: { name?: string; n?: number; what?: string } = {}): string =>
  ADORN_SAID[key].replaceAll('{name}', capital(f.name ?? '')).replaceAll('{n}', String(f.n ?? '')).replaceAll('{what}', f.what ?? '');

/** What each job says done, in the island's words (`adorn_done`): `{what}` a thing, `{n}`, `{held}` and `{of}` counts. */
export const ADORN_DONE = {
  lily: 'Planted: water lily. Lilies: {held} of {of}.',
  pea: 'Sweet peas: {what}.',
  peaSeason: 'Sweet peas: by season.',
  sown: 'Sown: {what}, slot {n}.',
  picked: 'Picked: {what} ×{n}, QL {held}. Slot {of}: growing again.',
  named: 'Buoy: “{what}”.',
  racked: 'On the rack: cheese ×{n}. Rack: {held} of {of}.',
  unracked: 'Off the rack: cheese ×{n}, QL {what}.',
  threw: 'Stones: {what} threw {n}, {held} of {of}.',
  won: 'Stones: {what} wins, {n} to {held}. Wins: {of}.',
  lineage: 'Pedigree board: {what}.',
  hung: 'Nameplate hung.',
  unhung: 'Nameplate taken down.',
};
export type AdornDone = keyof typeof ADORN_DONE;
export const adornDone = (key: AdornDone, f: { what?: string; n?: number; held?: number | string; of?: number } = {}): string =>
  ADORN_DONE[key].replace('{what}', f.what ?? '').replace('{n}', String(f.n ?? '')).replace('{held}', String(f.held ?? '')).replace('{of}', String(f.of ?? ''));

/* ---- the line under a piece's name ----------------------------------------------------------- */

/** What follows an adornment's quality on the line under its name. */
export function adornTail(g: Game | undefined, f: PlacedFurniture, now = Date.now() / 1000): string {
  const d = f.adorn;
  const out: string[] = [];
  const seats = furnitureDef(f.kind).seats ?? 0;
  if (seats) out.push(`seats ${seats}`);
  switch (f.kind) {
    case LILY_POND: out.push(`${liliesIn(f)} of ${POND_LILIES} lilies`); break;
    case GARDEN_OBELISK: out.push(`sweet peas ${peaColour(f, now)}${d?.pea ? '' : ' (season)'}`); break;
    case HERB_SPIRAL: out.push(SLOTS.map((i) => {
      const h = d?.herbs?.[i];
      const c = h ? cropOf(h[0]) : undefined;
      return h && c ? `${c.name.toLowerCase()} ${slotRipe(c, h[1], now) ? 'ripe' : `${Math.floor(slotGrown(c, h[1], now) * 100)}%`}` : 'empty';
    }).join(', ')); break;
    case BUOY: out.push(f.engraving ? `“${f.engraving}”` : 'unnamed'); break;
    case CHEESE_RACK: out.push(`${cheeseOn(f)} of ${RACK_HOLDS} cheeses${d?.cheese?.length
      ? `: QL ${d.cheese.map(([ql, at]) => rackQl(ql, now - at, (f.level ?? 0) < 0).toFixed(1)).join(', ')}` : ''}`); break;
    case PLUSH: out.push(d?.plush ? kindNameOf(d.plush).toLowerCase() : 'no kind'); break;
    case GAME_TABLE: {
      const r = d?.round;
      if (r) out.push(`round: ${r.an} ${r.as}${r.b ? `, ${r.bn} ${r.bs}` : ''} of ${STONES_GOAL}`);
      const w = winsOf(f);
      out.push(w.length ? `wins: ${w.map(([, n, k]) => `${n} ${k}`).join(', ')}` : 'no wins');
      break;
    }
    case PEDIGREE_BOARD: out.push(d?.tree ? `${lineWords(d.tree)}: dam ${lineWords(d.tree.d)}, sire ${lineWords(d.tree.s)}` : 'no wildermon'); break;
    default:
      if (isDenBed(f.kind) && d?.plate !== undefined) out.push(`nameplate: ${g ? plateWords(plateWorker(g, f)) : 'no worker'}`);
      break;
  }
  return out.length ? ` · ${out.join(' · ')}` : '';
}
export const ADORN_PIECES: readonly string[] = [
  LILY_POND, IVY_PANEL, GARDEN_OBELISK, HERB_SPIRAL, BUOY, CAULDRON_HEARTH, CHEESE_RACK, PELT_RUG, PLUSH, GAME_TABLE, GEM_LAMP, PEDIGREE_BOARD,
];
/** The game the line under a piece's name is read in, set by the game when it starts (`Game`): a nameplate's worker is its creatures'. */
export const ADORN_GAME: { g?: Game } = {};
STATE_TAILS.push((f) => (ADORN_PIECES.includes(f.kind) || (isDenBed(f.kind) && f.adorn?.plate !== undefined) ? adornTail(ADORN_GAME.g, f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const POND_LILY = 'pond_lily';
export const PEA_PICK = (c: string): string => `pea_${c}`;
export const PEA_SEASON = 'pea_season';
export const SPIRAL_SOW = 'spiral_sow';
export const SPIRAL_TAKE = (i: number): string => `spiral_pick_${i}`;
export const NAME_BUOY = 'name_buoy';
export const RACK_PUT = 'cheese_put';
export const RACK_TAKE = 'cheese_take';
export const THROW_STONES = 'throw_stones';
export const SET_LINEAGE = 'set_lineage';
export const READ_LINEAGE = 'read_lineage';
export const HANG_PLATE = 'hang_plate';
export const TAKE_PLATE = 'take_plate';
/** Every job at an adornment, by id: the island's `adorn_action`. */
export const ADORN_JOBS: readonly string[] = [
  POND_LILY, ...PEA_NAMES.map(PEA_PICK), PEA_SEASON, SPIRAL_SOW, ...SLOTS.map(SPIRAL_TAKE), NAME_BUOY, RACK_PUT, RACK_TAKE, THROW_STONES, SET_LINEAGE, READ_LINEAGE,
  HANG_PLATE, TAKE_PLATE,
];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, ok: (kind: string) => boolean): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && ok(f.kind) ? f : undefined;
};
const kindIs = (kind: string) => (k: string): boolean => k === kind;
/** The pieces each job is done at. */
const KIND_OF: Record<string, (k: string) => boolean> = {
  [POND_LILY]: kindIs(LILY_POND), [PEA_SEASON]: kindIs(GARDEN_OBELISK), [SPIRAL_SOW]: kindIs(HERB_SPIRAL), [NAME_BUOY]: kindIs(BUOY),
  [RACK_PUT]: kindIs(CHEESE_RACK), [RACK_TAKE]: kindIs(CHEESE_RACK), [THROW_STONES]: kindIs(GAME_TABLE), [SET_LINEAGE]: kindIs(PEDIGREE_BOARD),
  [READ_LINEAGE]: kindIs(PEDIGREE_BOARD), [HANG_PLATE]: isDenBed, [TAKE_PLATE]: isDenBed,
  ...Object.fromEntries(PEA_NAMES.map((c) => [PEA_PICK(c), kindIs(GARDEN_OBELISK)])),
  ...Object.fromEntries(SLOTS.map((i) => [SPIRAL_TAKE(i), kindIs(HERB_SPIRAL)])),
};

/**
 * Why a job at an adornment cannot be done now, or null: in the island's
 * order -- there, in reach, whose, and then the piece (`adorn_refusal`).
 */
export function adornRefusal(g: Game, id: string, t: Target, now = g.wallNow()): string | null {
  const f = pieceOf(g, t, KIND_OF[id] ?? (() => false));
  if (!f) return 'It is gone.';
  const d = f.adorn ?? {};
  if (!g.besidePiece(f)) return lampTooFar(nameOf(f.kind));
  if (id === POND_LILY) {
    if (liliesIn(f) >= POND_LILIES) return ADORN_SAID.pondFull;
    return g.inventory.items.some((it) => it.id === 'lily_root' && !it.locked) ? null : ADORN_SAID.noLily;
  }
  if (id === PEA_SEASON) return d.pea === undefined ? adornSaid('samePea', { what: 'by season' }) : null;
  const pea = PEA_NAMES.find((c) => id === PEA_PICK(c));
  if (pea) return d.pea === pea ? adornSaid('samePea', { what: pea }) : null;
  if (id === SPIRAL_SOW) {
    const slot = (t as { slot?: number }).slot;
    if (slot === undefined || !SLOTS.includes(slot)) return ADORN_SAID.noSlot;
    if (d.herbs?.[slot]) return adornSaid('slotSown', { n: slot + 1 });
    const uid = (t as { itemUid?: number }).itemUid;
    const it = uid !== undefined ? g.inventory.get(uid) : g.inventory.items.find((x) => SPIRAL_SEEDS.includes(x.id) && !x.locked);
    if (!it) return ADORN_SAID.noSeed;
    return SPIRAL_SEEDS.includes(it.id) && !it.locked ? null : ADORN_SAID.notSeed;
  }
  const slot = SLOTS.find((i) => id === SPIRAL_TAKE(i));
  if (slot !== undefined) {
    const h = d.herbs?.[slot];
    const c = h ? cropOf(h[0]) : undefined;
    if (!h || !c) return adornSaid('slotEmpty', { n: slot + 1 });
    return slotRipe(c, h[1], now) ? null : adornSaid('notRipe', { n: slot + 1 });
  }
  if (id === NAME_BUOY) {
    if (f.mine === false && !g.onDeed(f.x, f.y)) return FURNISH_SAID.cairnNotYours;
    const asked = (t as { name?: unknown }).name;
    if (typeof asked !== 'string') return null;
    const text = cleanLine(asked, CAIRN_NAME_MAX);
    if (!text) return FURNISH_SAID.noName;
    return text === f.engraving ? FURNISH_SAID.sameName : null;
  }
  if (id === RACK_PUT || id === RACK_TAKE) {
    if (f.mine === false) return adornSaid('notYours', { name: nameOf(f.kind) });
    if (id === RACK_TAKE) return cheeseOn(f) ? null : ADORN_SAID.rackEmpty;
    if (cheeseOn(f) >= RACK_HOLDS) return ADORN_SAID.rackFull;
    const it = toRack(g, t);
    if (!it) return ADORN_SAID.noCheese;
    return it.id === CHEESE && !it.locked ? null : ADORN_SAID.notCheese;
  }
  if (id === THROW_STONES) {
    // Whether somebody else is at the table, and who you are, are the island's to know; a round between two others, and whose throw it is, by name.
    const r = d.round, me = g.player.name;
    if (r?.b && r.an !== me && r.bn !== me) return adornSaid('roundOn', { what: `${r.an} and ${r.bn}` });
    const next = r ? nextThrower(r) : null;
    if (r && (r.last === r.a ? r.an : r.bn) === me) return adornSaid('notTurn', { what: next ?? 'another player' });
    return null;
  }
  if (id === SET_LINEAGE) {
    if (f.mine === false) return ADORN_SAID.boardNotYours;
    const cid = (t as { creature?: number }).creature;
    if (cid === undefined) return ADORN_SAID.pickCreature;
    const c = g.creatures.list.get(cid);
    if (c && c.mine === false) return ADORN_SAID.notKept;
    return d.tree?.id === cid ? adornSaid('sameCreature', { what: d.tree.n }) : null;
  }
  if (id === READ_LINEAGE) return d.tree ? null : ADORN_SAID.noLine;
  if (id === HANG_PLATE) {
    if (f.mine === false) return adornSaid('notYours', { name: nameOf(f.kind) });
    if (d.plate !== undefined) return ADORN_SAID.plateOn;
    return g.inventory.items.some((it) => it.id === NAMEPLATE && !it.locked) ? null : ADORN_SAID.noPlate;
  }
  if (id === TAKE_PLATE) {
    if (f.mine === false) return adornSaid('notYours', { name: nameOf(f.kind) });
    return d.plate !== undefined ? null : ADORN_SAID.noPlateOn;
  }
  return null;
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.01,
  ...o,
  check: (t, g) => adornRefusal(g, o.id, t),
  // The island's (`perform_adorn`).
  perform: () => undefined,
});
const at = (ok: (k: string) => boolean) => (t: Target, g: Game): boolean => !!pieceOf(g, t, ok);

export const ADORN_ACTIONS: ActionDef[] = [
  job({ id: POND_LILY, label: 'Plant a water lily', verb: 'planting a water lily', baseTime: ADORN_TIME, applies: at(kindIs(LILY_POND)) }),
  ...PEA_NAMES.map((c) => job({
    // The menu offers them under one line (`Sweet peas`).
    id: PEA_PICK(c), label: `Sweet peas: ${c}`, verb: 'choosing sweet peas', instant: true, baseTime: 0, stamina: 0, hidden: true, applies: at(kindIs(GARDEN_OBELISK)),
  })),
  job({ id: PEA_SEASON, label: 'Sweet peas: by season', verb: 'choosing sweet peas', instant: true, baseTime: 0, stamina: 0, hidden: true, applies: at(kindIs(GARDEN_OBELISK)) }),
  job({
    // The menu offers it, a slot and a seed to a line (`Sow`).
    id: SPIRAL_SOW, label: 'Sow', verb: 'sowing herbs', skill: 'farming', baseTime: ADORN_TIME, hidden: true, applies: at(kindIs(HERB_SPIRAL)),
  }),
  ...SLOTS.map((i) => job({
    id: SPIRAL_TAKE(i), label: `Pick slot ${i + 1}`, verb: 'picking herbs', skill: 'farming', baseTime: ADORN_TIME,
    labelFor: (t, g) => {
      const h = pieceOf(g, t, kindIs(HERB_SPIRAL))?.adorn?.herbs?.[i];
      return h ? `Pick ${(cropOf(h[0])?.name ?? h[0]).toLowerCase()} (slot ${i + 1})` : `Pick slot ${i + 1}`;
    },
    applies: (t, g) => !!pieceOf(g, t, kindIs(HERB_SPIRAL))?.adorn?.herbs?.[i],
  })),
  {
    ...job({
      id: NAME_BUOY, label: 'Name', verb: 'naming the buoy', baseTime: CAIRN_NAME_TIME, stamina: 0.02,
      labelFor: (t, g) => (pieceOf(g, t, kindIs(BUOY))?.engraving ? 'Rename' : 'Name'),
      applies: at(kindIs(BUOY)),
    }),
    asks: {
      question: `Buoy name: up to ${CAIRN_NAME_MAX} characters.`,
      fallback: (t, g) => pieceOf(g, t, kindIs(BUOY))?.engraving ?? '',
      declined: 'Left unchanged.',
      max: CAIRN_NAME_MAX,
    },
  },
  job({
    // The menu offers it, a cheese in the pack to a line (`Put on the rack`).
    id: RACK_PUT, label: 'Put on the rack', verb: 'racking cheese', baseTime: ADORN_TIME, hidden: true, applies: at(kindIs(CHEESE_RACK)),
  }),
  job({
    id: RACK_TAKE, label: 'Take the cheese', verb: 'taking cheese off the rack', baseTime: ADORN_TIME,
    labelFor: (t, g) => `Take the cheese ×${cheeseOn(pieceOf(g, t, kindIs(CHEESE_RACK)) ?? {})}`,
    applies: (t, g) => cheeseOn(pieceOf(g, t, kindIs(CHEESE_RACK)) ?? {}) > 0,
  }),
  job({ id: THROW_STONES, label: 'Throw the stones', verb: 'throwing stones', baseTime: THROW_TIME, applies: at(kindIs(GAME_TABLE)) }),
  job({
    // The menu offers it, a wildermon of yours to a line (`Show lineage`).
    id: SET_LINEAGE, label: 'Show lineage', verb: 'setting a lineage', baseTime: LINEAGE_TIME, hidden: true, applies: at(kindIs(PEDIGREE_BOARD)),
  }),
  job({ id: READ_LINEAGE, label: 'Examine', verb: 'reading the board', instant: true, baseTime: 0, stamina: 0, applies: (t, g) => !!pieceOf(g, t, kindIs(PEDIGREE_BOARD))?.adorn?.tree }),
  job({
    id: HANG_PLATE, label: 'Hang a nameplate', verb: 'hanging a nameplate', baseTime: ADORN_TIME,
    applies: (t, g) => { const f = pieceOf(g, t, isDenBed); return !!f && f.adorn?.plate === undefined && g.inventory.items.some((it) => it.id === NAMEPLATE); },
  }),
  job({ id: TAKE_PLATE, label: 'Take down the nameplate', verb: 'taking down a nameplate', baseTime: ADORN_TIME, applies: (t, g) => pieceOf(g, t, isDenBed)?.adorn?.plate !== undefined }),
];

/* ---- descriptions ------------------------------------------------------------------------ */

const seatWords = (kind: string): string => `Seats ${furnitureDef(kind).seats ?? 0}: Sit.`;
/** Every waterside find, as the pond's description says it: "water lily root or lotus seed". */
export const watersideWords = (): string => listedOr(WATERSIDE_FINDS.map(([id]) => wordOf(id)));
/** The pot dishes a cauldron makes, by name. */
export const potDishWords = (): string => listed([...new Set(POT_DISHES.map((r) => wordOf(r.result)))]);
describeFrom(LILY_POND, { finds: watersideWords(), lilies: POND_LILIES });
describeFrom(IVY_PANEL, { days: IVY_PANEL_DAYS });
describeFrom(IVY_CUTTING, { n: IVY_CUTTINGS });
describeFrom(GARDEN_OBELISK, { rule: SWEET_PEA_RULE, colours: listed(PEA_NAMES), spring: PEA_BY_SEASON.spring, summer: PEA_BY_SEASON.summer });
describeFrom(HERB_SPIRAL, { slots: SPIRAL_SLOTS, herbs: listed(SPIRAL_HERBS.map((c) => c.name.toLowerCase())), pick: SPIRAL_PICK });
describeFrom(BUOY, { max: CAIRN_NAME_MAX, reach: plural(BUOY_REACH, 'tile', 'tiles') });
describeFrom(CAULDRON_HEARTH, { n: CAULDRON_SERVINGS, dishes: potDishWords() });
describeFrom(CHEESE_RACK, { holds: RACK_HOLDS, rate: CHEESE_AGEING.rate, cap: CHEESE_AGEING.cap, cellar: CELLAR_AGEING });
describeFrom(GAME_TABLE, { seat: seatWords(GAME_TABLE), players: TABLE_SEATS, least: STONES_LEAST, goal: STONES_GOAL, sides: STONES_SIDES });
describeFrom(GEM_LAMP, { reach: plural(GEM_LAMP_REACH, 'tile', 'tiles'), gems: GEMS.length });
