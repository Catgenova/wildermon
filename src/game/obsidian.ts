/**
 * The obsidian pieces (`obsidiandefs.ts` holds their numbers): a black glass
 * lantern, an obsidian throne, an obsidian obelisk, a dragon-glass fountain, a
 * shard garden, an obsidian vase, a lava lamp column, an obsidian wind chime,
 * an obsidian bust, a glass shard path and an ember orb on a stand. Each is on
 * a rule the island already keeps:
 *
 *   * a black glass lantern takes a candle, lit off a flame, as a paper
 *     lantern pole does: the candle is the piece's `fuel` and whether it burns
 *     its `lit` (`placed_fuel`, `placed_lit`);
 *   * a throne is a seat (`sit_seat`, `furnish.ts`), sat in only by the founder
 *     of the settlement it stands on; Examine reads that settlement now;
 *   * an obelisk is named as a cairn is (the placed row's `engraving`);
 *   * a dragon-glass fountain is a fountain (`isFountain`): a well, and the foot of an aqueduct;
 *   * an obsidian vase holds wildflowers by the vase's rule (`isVase`, `furnish.ts`);
 *   * an obsidian bust is carved as a citizen by the stone bust's rule (`BUSTS`, `fitting.ts`);
 *   * an obsidian wind chime hangs and chimes as a wind chime, louder the harder the wind;
 *   * a glass shard path goes along a side of its tile (`Mount` `edge`), a side a piece;
 *   * a lava lamp column and an ember orb light the night always, the orb by how dark it is.
 *
 * The island does every job (`obsidian_refusal`, `perform_obsidian`); what is
 * here says the same refusals in the same order and names the menus.
 */
import type { ActionDef, Target } from './actions';
import {
  BLACK_LANTERN, BLACK_LANTERN_REACH, DRAGON_FOUNTAIN, EMBER_CAST, EMBER_CAST_ALPHA, EMBER_ORB, GLASS_CHIME_LEAST, LANTERN_CANDLES, LAVA_LAMP, LAVA_LAMP_REACH, OBELISK_GLINT,
  OBSIDIAN_CHIME, OBSIDIAN_FIT_TIME, OBSIDIAN_OBELISK, OBSIDIAN_THRONE, OBSIDIAN_VASE, ORB_DAY_REACH, ORB_NIGHT_REACH,
  THRONE_SEATS,
} from './obsidiandefs';
import { furnitureCentre, furnitureDef, FOUNTAIN_HOLDS, WELL_TRICKLE, WELL_TRICKLE_AT, WELL_TRICKLE_QL, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom } from './items';
import { lampTooFar, LAMP_STRENGTH } from './lamps';
import { candleBurn, type LightSource } from './light';
import { flameNear, noFlameLine } from './lantern';
import { STATE_TAILS } from './pieceTails';
import { timeWords } from './words';
import { cleanLine } from './chat';
import { CAIRN_NAME_MAX, CAIRN_NAME_TIME, VASE_FRESH, VASE_HOLDS } from './furnishdefs';
import { FURNISH_SAID, SEAT_REFUSALS } from './furnish';
import { CHIME_STILL } from './gardendefs';
import { DAWN, DUSK } from './pace';

const nameOf = (kind: string): string => furnitureDef(kind).name.toLowerCase();
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---- a black glass lantern --------------------------------------------------------------- */

/** Seconds a candle put in a black glass lantern burns: a candle's in a lantern of its QL. The island's `black_lantern_burn`. */
export const blackLanternBurn = (ql: number): number => Math.round(candleBurn(ql));
/** Whether its candle burns now. */
export const blackLanternBurning = (f: PlacedFurniture): boolean => f.kind === BLACK_LANTERN && !!f.lit && (f.fuel ?? 0) > 0;
/** Its light while its candle burns: `BLACK_LANTERN_REACH` tiles, steady, in an ember's colour. */
export function blackLanternLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: BLACK_LANTERN_REACH, strength: LAMP_STRENGTH, steady: true, cast: EMBER_CAST, castAlpha: EMBER_CAST_ALPHA };
}

/* ---- an obsidian throne ------------------------------------------------------------------ */

/** Whether you founded the settlement on tile (x, y): one of yours there, on which you are its founder. */
export const founderAt = (g: Game, x: number, y: number): boolean => {
  const d = g.deedOfMineAt(x, y);
  return !!d && (d.role ?? 'founder') === 'founder';
};
/** Why a throne is not yours to sit in, or null: its settlement's founder's alone. The island's `furnish_refusal`. */
export const throneRefusal = (g: Game, f: PlacedFurniture): string | null =>
  (f.kind !== OBSIDIAN_THRONE || founderAt(g, f.x, f.y) ? null : OBSIDIAN_SAID.founder);
SEAT_REFUSALS.push(throneRefusal);

/* ---- an obsidian obelisk ----------------------------------------------------------------- */

/** How strong an obelisk's glint is at game hour `h`, nought to one: full at dawn and at dusk, gone `OBELISK_GLINT` hours either side. */
export function obeliskGlint(h: number): number {
  const off = Math.min(Math.abs(h - DAWN), Math.abs(h - DUSK), Math.abs(h + 24 - DUSK), Math.abs(DAWN + 24 - h));
  return Math.max(0, 1 - off / OBELISK_GLINT);
}

/* ---- a lava lamp column and an ember orb -------------------------------------------------- */

/** A lava lamp column's light, always on: `LAVA_LAMP_REACH` tiles in an ember's colour. */
export function lavaLampLight(f: PlacedFurniture): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: LAVA_LAMP_REACH, strength: LAMP_STRENGTH, steady: true, cast: EMBER_CAST, castAlpha: EMBER_CAST_ALPHA };
}
/** Tiles an ember orb lights at a darkness (`Game.darkness`, nought by day, one at full night): `ORB_DAY_REACH` to `ORB_NIGHT_REACH`. */
export const orbReach = (dark: number): number => ORB_DAY_REACH + (ORB_NIGHT_REACH - ORB_DAY_REACH) * Math.max(0, Math.min(1, dark));
/** An ember orb's light at a darkness. */
export function orbLight(f: PlacedFurniture, dark: number): LightSource {
  const [x, y] = furnitureCentre(f);
  return { x, y, radius: orbReach(dark), strength: LAMP_STRENGTH, steady: true, cast: EMBER_CAST, castAlpha: EMBER_CAST_ALPHA };
}

/* ---- an obsidian wind chime --------------------------------------------------------------- */

/** How loud an obsidian chime rings in wind of `force`, × its loudest: `GLASS_CHIME_LEAST` at `CHIME_STILL`, rising evenly to one at full wind; silent under it. */
export const glassChimeLoud = (force: number): number =>
  (force < CHIME_STILL ? 0 : GLASS_CHIME_LEAST + (1 - GLASS_CHIME_LEAST) * Math.min(1, (force - CHIME_STILL) / (1 - CHIME_STILL)));

/* ---- the words --------------------------------------------------------------------------- */

/** Every refusal, in the island's words (`obsidian_said`). */
export const OBSIDIAN_SAID = {
  candleIn: 'Candle still in it.',
  noCandles: `Need ${plural(LANTERN_CANDLES, 'candle', 'candles')}.`,
  noCandle: 'No candle in it.',
  lit: 'Already lit.',
  notLit: 'Not lit.',
  founder: 'Obsidian throne: its settlement\'s founder only.',
  noDeed: 'Not on a settlement.',
};
export type ObsidianSaid = keyof typeof OBSIDIAN_SAID;

/** What each job says done, in the island's words (`obsidian_done`): `{what}` a thing, `{n}`, `{held}` and `{of}` counts. */
export const OBSIDIAN_DONE = {
  candle: `Candle in: ${LANTERN_CANDLES}. Burns {what}.`,
  lit: `Lit from the {what}: light ${BLACK_LANTERN_REACH} tiles at night.`,
  out: 'Put out. Candle left: {what}.',
  named: 'Obelisk: “{what}”.',
  throne: '{what}: level {n} · citizens {held} · workers {of}.',
};
export type ObsidianDone = keyof typeof OBSIDIAN_DONE;
export const obsidianDone = (key: ObsidianDone, f: { what?: string; n?: number; held?: number; of?: number } = {}): string =>
  OBSIDIAN_DONE[key].replace('{what}', f.what ?? '').replace('{n}', String(f.n ?? '')).replace('{held}', String(f.held ?? '')).replace('{of}', String(f.of ?? ''));

/* ---- the line under a piece's name ----------------------------------------------------------- */

/** What follows an obsidian piece's quality on the line under its name. */
export function obsidianTail(f: PlacedFurniture): string {
  const out: string[] = [];
  switch (f.kind) {
    case BLACK_LANTERN: {
      const left = Math.max(0, f.fuel ?? 0);
      out.push(left <= 0 ? 'no candle' : `${timeWords(left)} of candle${blackLanternBurning(f) ? `, lit: light ${BLACK_LANTERN_REACH} tiles at night` : ', unlit'}`);
      break;
    }
    case OBSIDIAN_THRONE: out.push(`seats ${THRONE_SEATS}, its settlement's founder only`); break;
    case OBSIDIAN_OBELISK: out.push(f.engraving ? `“${f.engraving}”` : 'unnamed'); break;
    case LAVA_LAMP: out.push(`light ${LAVA_LAMP_REACH} tiles at night`); break;
    case EMBER_ORB: out.push(`light ${ORB_DAY_REACH} tile by day, ${ORB_NIGHT_REACH} at night`); break;
    default: break;
  }
  return out.length ? ` · ${out.join(' · ')}` : '';
}
const TAILED: readonly string[] = [BLACK_LANTERN, OBSIDIAN_THRONE, OBSIDIAN_OBELISK, LAVA_LAMP, EMBER_ORB];
STATE_TAILS.push((f) => (TAILED.includes(f.kind) ? obsidianTail(f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const LANTERN_CANDLE = 'black_lantern_candle';
export const LANTERN_LIGHT = 'black_lantern_light';
export const LANTERN_DOUSE = 'black_lantern_douse';
export const READ_THRONE = 'read_throne';
export const NAME_OBELISK = 'name_obelisk';
/** Every job at an obsidian piece, by id: the island's `obsidian_action`. */
export const OBSIDIAN_JOBS: readonly string[] = [LANTERN_CANDLE, LANTERN_LIGHT, LANTERN_DOUSE, READ_THRONE, NAME_OBELISK];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, kind: string): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && f.kind === kind ? f : undefined;
};
/** The piece each job is done at, by its kind. */
const KIND_OF: Record<string, string> = {
  [LANTERN_CANDLE]: BLACK_LANTERN, [LANTERN_LIGHT]: BLACK_LANTERN, [LANTERN_DOUSE]: BLACK_LANTERN, [READ_THRONE]: OBSIDIAN_THRONE, [NAME_OBELISK]: OBSIDIAN_OBELISK,
};

/**
 * Why a job at an obsidian piece cannot be done now, or null: in the island's
 * order -- there, in reach, and then the piece (`obsidian_refusal`).
 */
export function obsidianRefusal(g: Game, id: string, t: Target): string | null {
  const f = pieceOf(g, t, KIND_OF[id] ?? '');
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(nameOf(f.kind));
  switch (id) {
    case LANTERN_CANDLE:
      if ((f.fuel ?? 0) > 0) return OBSIDIAN_SAID.candleIn;
      return g.inventory.count('candle') >= LANTERN_CANDLES ? null : OBSIDIAN_SAID.noCandles;
    case LANTERN_LIGHT:
      if ((f.fuel ?? 0) <= 0) return OBSIDIAN_SAID.noCandle;
      if (f.lit) return OBSIDIAN_SAID.lit;
      return flameNear(g) ? null : noFlameLine();
    case LANTERN_DOUSE: return blackLanternBurning(f) ? null : OBSIDIAN_SAID.notLit;
    case READ_THRONE: return g.deedOfMineAt(f.x, f.y) || g.deedAt(f.x, f.y) ? null : OBSIDIAN_SAID.noDeed;
    case NAME_OBELISK: {
      if (f.mine === false && !g.onDeed(f.x, f.y)) return FURNISH_SAID.cairnNotYours;
      const asked = (t as { name?: unknown }).name;
      if (typeof asked !== 'string') return null;
      const text = cleanLine(asked, CAIRN_NAME_MAX);
      if (!text) return FURNISH_SAID.noName;
      return text === f.engraving ? FURNISH_SAID.sameName : null;
    }
    default: return null;
  }
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.01,
  ...o,
  check: (t, g) => obsidianRefusal(g, o.id, t),
  // The island's (`perform_obsidian`).
  perform: () => undefined,
});

export const OBSIDIAN_ACTIONS: ActionDef[] = [
  job({ id: LANTERN_CANDLE, label: 'Put in a candle', verb: 'setting a candle', baseTime: OBSIDIAN_FIT_TIME, applies: (t, g) => !!pieceOf(g, t, BLACK_LANTERN) }),
  job({
    id: LANTERN_LIGHT, label: 'Strike a light', verb: 'lighting the lantern', instant: true, baseTime: 0, stamina: 0,
    applies: (t, g) => { const f = pieceOf(g, t, BLACK_LANTERN); return !!f && !f.lit && (f.fuel ?? 0) > 0; },
  }),
  job({ id: LANTERN_DOUSE, label: 'Put it out', verb: 'putting the lantern out', instant: true, baseTime: 0, stamina: 0, applies: (t, g) => !!pieceOf(g, t, BLACK_LANTERN)?.lit }),
  job({ id: READ_THRONE, label: 'Examine', verb: 'reading the settlement', instant: true, baseTime: 0, stamina: 0, applies: (t, g) => !!pieceOf(g, t, OBSIDIAN_THRONE) }),
  {
    ...job({
      id: NAME_OBELISK, label: 'Name', verb: 'engraving the obelisk', baseTime: CAIRN_NAME_TIME, stamina: 0.02,
      labelFor: (t, g) => (pieceOf(g, t, OBSIDIAN_OBELISK)?.engraving ? 'Rename' : 'Name'),
      applies: (t, g) => !!pieceOf(g, t, OBSIDIAN_OBELISK),
    }),
    asks: {
      question: `Obelisk name: up to ${CAIRN_NAME_MAX} characters.`,
      fallback: (t, g) => pieceOf(g, t, OBSIDIAN_OBELISK)?.engraving ?? '',
      declined: 'Left unchanged.',
      max: CAIRN_NAME_MAX,
    },
  },
];

/* ---- descriptions ------------------------------------------------------------------------ */

const hour = (h: number): string => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
/** The game hours an obelisk glints, as the help and its item say them: "02:30–03:30 and 20:30–21:30". */
export const glintWords = (): string =>
  [DAWN, DUSK].map((h) => `${hour(h - OBELISK_GLINT)}–${hour(h + OBELISK_GLINT)}`).join(' and ');
const pct = (n: number): number => Math.round(n * 100);
describeFrom(BLACK_LANTERN, { n: LANTERN_CANDLES, reach: BLACK_LANTERN_REACH, burn: timeWords(blackLanternBurn(50)), ql: 50 });
describeFrom(OBSIDIAN_THRONE, { seats: THRONE_SEATS });
describeFrom(OBSIDIAN_OBELISK, { max: CAIRN_NAME_MAX, glint: glintWords() });
describeFrom(DRAGON_FOUNTAIN, { least: (WELL_TRICKLE * 60).toFixed(1), most: ((WELL_TRICKLE + WELL_TRICKLE_QL) * 60).toFixed(1), top: WELL_TRICKLE_AT, holds: FOUNTAIN_HOLDS });
describeFrom(OBSIDIAN_VASE, { holds: VASE_HOLDS, fresh: plural(VASE_FRESH, 'day', 'days') });
describeFrom(LAVA_LAMP, { reach: LAVA_LAMP_REACH });
/** The strongest wind there is (`Wind.force`). */
export const FULL_WIND = 1;
describeFrom(OBSIDIAN_CHIME, { still: pct(CHIME_STILL), least: GLASS_CHIME_LEAST, most: glassChimeLoud(FULL_WIND), full: pct(FULL_WIND) });
describeFrom(EMBER_ORB, { day: ORB_DAY_REACH, night: ORB_NIGHT_REACH });
