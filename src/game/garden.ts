/**
 * The garden pieces (`gardendefs.ts` holds their numbers): what each holds,
 * how it grows, and the jobs done at it. The island does every job
 * (`perform_garden`, `garden_refusal`); what is here says the same refusals
 * in the same order, names the menus, and reads what the island keeps.
 *
 * What the island keeps of a piece is `placed.garden` (and `item.garden` for
 * one in the pack), sent to every browser with the ground read:
 *
 *   bloom     the wildflower kinds planted in a bed, a window box or a basket, a slot each;
 *   shape     a topiary shrub's shape, and `trim_at` its last trim (epoch seconds);
 *   clip      a hedge's clip;
 *   prunes    a bonsai's steps of shaping, and `prune_at` its last prune;
 *   figure    the kind a carved figure is carved as, chosen at the bench;
 *   held      a trophy on a plaque, potted plants on a stand: `def`, `ql`, `rare`, `by` (its slayer's or maker's name).
 *
 * How far anything has grown is read off the moment the piece was set down
 * (`placed.made_at`, which the ground read hands over as `set` for these
 * pieces) and the season, as an arch's roses are (`roses.ts`): the same for
 * everybody looking.
 */
import type { ActionDef, Target } from './actions';
import { HEDGE_CLIPS, type BloomKind, type HedgeClip, type TopiaryShape, BLOOM_COST, BLOOM_KINDS, BLOOM_SKILL, BLOOM_TIME, BONSAI_GROWN, BONSAI_STEPS, CLEAR_TIME, CLIP_TIME,
  HEDGE_FULL, PRUNE_REST, PRUNE_SKILL, PRUNE_TIME, PRUNE_TOOL, SHOW_TIME, TOPIARY_GROWS_OUT, TOPIARY_SHAPES, TRIM_SKILL, TRIM_TIME, TRIM_TOOL, POTS,
  HERB_SHARE, HERB_BOX, CARVED_FIGURE, BIRDS_AWAY, BIRDS_MOST, CHIME_STILL, HANG_FROM, FOLDING_SCREEN, FLOWER_CART, mountWords, SHOWING_SAID, type Mount } from './gardendefs';
import { FACINGS, facingOf, furnitureDef, FURNITURE, turnedFacing, type FurnitureDef, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef, ITEM_DEFS } from './items';
import { lampTooFar } from './lamps';
import { DAY_SECONDS } from './pace';
import { STATE_TAILS } from './pieceTails';
import { CLIMBER_NAME, roseSays, roseStage, ROSE_BUD, ROSE_FLOWER, ROSE_LEAFY, ROSE_SEASONS, type RoseStage } from './roses';
import { capital, listed, listedOr, spanWords } from './words';
import { CROP_LIST } from './farming';
import { SPECIES } from './creatures';
import { guidePages } from './guide';
import { SUBTILES } from './limits';
import { isDone, trellisWallWords, WALL_TYPE_BY_ID, type Side } from './building';

const DAY = DAY_SECONDS;

/* ---- what the island keeps --------------------------------------------------------------- */

/** One thing on show: a trophy on a plaque, a potted plant on a stand. */
export interface Shown { def: string; ql: number; rare?: string; by?: string }

/** What a garden piece holds and how it was last shaped (`placed.garden`). */
export interface GardenState {
  bloom?: BloomKind[];
  shape?: TopiaryShape;
  trimAt?: number;
  clip?: HedgeClip;
  prunes?: number;
  pruneAt?: number;
  figure?: string;
  held?: Shown[];
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The island's `garden` as this side keeps it, or undefined for none: only what is well formed. */
export function gardenFrom(raw: unknown): GardenState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: GardenState = {};
  if (Array.isArray(r.bloom)) out.bloom = r.bloom.filter((k): k is BloomKind => (BLOOM_KINDS as readonly unknown[]).includes(k));
  if ((TOPIARY_SHAPES as readonly unknown[]).includes(r.shape)) out.shape = r.shape as TopiaryShape;
  if (isNum(r.trim_at)) out.trimAt = r.trim_at;
  if ((HEDGE_CLIPS as readonly unknown[]).includes(r.clip)) out.clip = r.clip as HedgeClip;
  if (isNum(r.prunes)) out.prunes = r.prunes;
  if (isNum(r.prune_at)) out.pruneAt = r.prune_at;
  if (isStr(r.figure)) out.figure = r.figure;
  if (Array.isArray(r.held)) {
    out.held = r.held.filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && isStr((h as Record<string, unknown>).def)).map((h) => ({
      def: h.def as string, ql: isNum(h.ql) ? h.ql : 1, ...(isStr(h.rare) ? { rare: h.rare } : {}), ...(isStr(h.by) ? { by: h.by } : {}),
    }));
  }
  return Object.keys(out).length ? out : undefined;
}

/* ---- which pieces ------------------------------------------------------------------------ */

/** Whether a piece is one of the garden pieces, with a line of its own under its name. */
export const isGardenPiece = (def: FurnitureDef): boolean =>
  !!(def.bloom || def.hedge || def.topiary || def.bonsai || def.shows || def.figure || def.birds || def.chime || def.herbs || def.mount)
  || def.climber === 'wisteria' || POTS.includes(def.id) || def.id === FOLDING_SCREEN || def.id === FLOWER_CART;
/** Whether a piece grows from the moment it is set down, so the island hands every browser that moment (`furniture_def.roses`). */
export const growsFromSet = (def: FurnitureDef): boolean => !!(def.climber || def.bloom || def.hedge || def.bonsai);

/* ---- how it grows ------------------------------------------------------------------------- */

/** The wildflowers in a bed, a box or a basket: by the rose arch's rule, from the moment it was set down. */
export const bloomStage = (setAt: number | undefined, now: number): { stage: RoseStage; days: number; blooms: boolean } => roseStage(setAt, now, 'rose');

/** How full a hedge is, nought bare to one full, `HEDGE_FULL` days after it is set down. */
export const hedgeGrowth = (setAt: number | undefined, now: number): number =>
  (setAt === undefined ? 1 : Math.max(0, Math.min(1, (now - setAt) / (HEDGE_FULL * DAY))));
/** How far a bonsai has grown, nought to one, `BONSAI_GROWN` days after it is set down. */
export const bonsaiGrowth = (setAt: number | undefined, now: number): number =>
  (setAt === undefined ? 1 : Math.max(0, Math.min(1, (now - setAt) / (BONSAI_GROWN * DAY))));
/**
 * How far a topiary shrub has grown back out of its shape, nought just
 * trimmed to one bushy: `TOPIARY_GROWS_OUT` days after its last trim. Never
 * trimmed, it is bushy.
 */
export const topiaryOut = (g: GardenState | undefined, now: number): number =>
  (!g?.shape || g.trimAt === undefined ? 1 : Math.max(0, Math.min(1, (now - g.trimAt) / (TOPIARY_GROWS_OUT * DAY))));
/** The shape a topiary shrub shows: its last, until it has grown out. */
export const topiaryShows = (g: GardenState | undefined, now: number): TopiaryShape | null =>
  (g?.shape && topiaryOut(g, now) < 1 ? g.shape : null);

/** Whether small birds are about a birdhouse: by day, out of `BIRDS_AWAY`. */
export const birdsAbout = (season: string, dark: number): boolean => !(BIRDS_AWAY as readonly string[]).includes(season) && dark < 0.5;
/** And a wind chime is silent under `CHIME_STILL` of wind. */
export const chimeSounds = (force: number): boolean => force >= CHIME_STILL;

/* ---- the words --------------------------------------------------------------------------- */

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;
const wordOf = (id: string): string => (itemDef(id)?.name ?? id).toLowerCase();
/** A topiary shape and a hedge clip as they are said. */
export const SHAPE_WORD: Record<TopiaryShape, string> = { ball: 'ball', cone: 'cone', spiral: 'spiral', wildermon: 'wildermon' };
export const CLIP_WORD: Record<HedgeClip, string> = { flat: 'flat', round: 'round' };

/**
 * Every refusal, in the island's words (`garden_said`): `{name}` is the
 * piece's own name, lower-cased, where the sentence wants it.
 */
export const GARDEN_SAID = {
  full: '{name}: full.',
  get flowers(): string { return `Need ${BLOOM_COST} wildflowers.`; },
  noFlowers: 'No flowers planted.',
  get trimTool(): string { return `Need a ${wordOf(TRIM_TOOL)}.`; },
  get pruneTool(): string { return `Need a ${wordOf(PRUNE_TOOL)}.`; },
  get hedgeYoung(): string { return `Hedge: clipped once full, ${days(HEDGE_FULL)} after it is set down.`; },
  clipped: 'Already clipped that way.',
  get shaped(): string { return `Bonsai: shaped, ${BONSAI_STEPS} of ${BONSAI_STEPS} steps.`; },
  get pruned(): string { return `Bonsai: one prune every ${days(PRUNE_REST)}.`; },
  noTrophy: 'No trophy in your pack.',
  noPot: `No potted plant in your pack.`,
  nothingShown: 'Nothing on it.',
  showing: SHOWING_SAID,
  notYours: 'Only whoever set it down, or a citizen of its settlement, may change what is on it.',
};
export type GardenSaid = keyof typeof GARDEN_SAID;

/**
 * What each job says done, in the island's words (`garden_done`): `{what}`
 * the kind, shape, clip or thing, `{n}` and `{of}` a count and its most.
 */
export const GARDEN_DONE = {
  planted: 'Planted: {what} wildflowers, {n} of {of}.',
  cleared: 'Pulled up: {n} wildflower kinds.',
  get trimmed(): string { return `Trimmed: {what}. Bushy again in ${days(TOPIARY_GROWS_OUT)}.`; },
  clipped: 'Clipped: {what}.',
  get pruned(): string { return `Pruned: shaped {n} of {of}. Next prune in ${days(PRUNE_REST)}.`; },
  shown: 'Put up: {what}.',
  taken: 'Taken down: {what}.',
};
export const gardenSaid = (key: GardenSaid, name: string): string => GARDEN_SAID[key].replace('{name}', capital(name));

/** What a bonsai's shaping says: "shaped 2 of 5". */
const shapedWords = (n: number): string => `shaped ${n} of ${BONSAI_STEPS}`;

/** What follows a garden piece's quality on the line under its name, in the island's words where it says them too. */
export function gardenTail(f: PlacedFurniture, now = Date.now() / 1000): string {
  const def = furnitureDef(f.kind);
  const g = f.garden;
  const out: string[] = [];
  if (def.bloom) {
    const kinds = g?.bloom ?? [];
    // How they stand, in the arch's words for its roses (`roseSays`), said of flowers.
    out.push(kinds.length ? `${kinds.join(', ')} (${kinds.length} of ${def.bloom}) · ${roseSays(f.setAt, now).replace(/^roses/, 'flowers')}` : `no flowers (0 of ${def.bloom})`);
  }
  if (def.hedge) {
    const k = hedgeGrowth(f.setAt, now);
    const set = f.setAt ?? now;
    out.push(k >= 1 ? `full${g?.clip ? `, clipped ${CLIP_WORD[g.clip]}` : ''}` : `growing, full in ${spanWords(set + HEDGE_FULL * DAY - now)}`);
  }
  if (def.topiary) {
    const shape = topiaryShows(g, now);
    out.push(shape && g?.trimAt !== undefined ? `${SHAPE_WORD[shape]}, grows out in ${spanWords(g.trimAt + TOPIARY_GROWS_OUT * DAY - now)}` : 'bushy');
  }
  if (def.bonsai) {
    const k = bonsaiGrowth(f.setAt, now);
    const set = f.setAt ?? now;
    out.push(`${k >= 1 ? 'grown' : `growing, grown in ${spanWords(set + BONSAI_GROWN * DAY - now)}`}, ${shapedWords(g?.prunes ?? 0)}`);
  }
  if (def.figure && g?.figure) out.push((SPECIES[g.figure]?.name ?? g.figure).toLowerCase());
  if (def.shows) {
    const held = g?.held ?? [];
    out.push(held.length ? held.map((h) => `${wordOf(h.def)}${h.by ? `, ${def.shows?.what === 'trophy' ? 'slain by' : 'by'} ${h.by}` : ''}`).join('; ') : 'empty');
  }
  return out.length ? ` · ${out.join(' · ')}` : '';
}
STATE_TAILS.push((f) => (isGardenPiece(furnitureDef(f.kind)) ? gardenTail(f) : ''));

/* ---- the jobs ---------------------------------------------------------------------------- */

export const PLANT_BLOOM = (k: BloomKind): string => `plant_${k}_flowers`;
export const CLEAR_BLOOMS = 'clear_flowers';
export const TRIM_TOPIARY = (s: TopiaryShape): string => `trim_topiary_${s}`;
export const CLIP_HEDGE = (c: HedgeClip): string => `clip_hedge_${c}`;
export const PRUNE_BONSAI = 'prune_bonsai';
export const SHOW_THING = 'show_on_piece';
export const TAKE_SHOWN = 'take_from_show';
/** Every job at a garden piece, by id: the island's `garden_action`. */
export const GARDEN_JOBS: readonly string[] = [
  ...BLOOM_KINDS.map(PLANT_BLOOM), CLEAR_BLOOMS, ...TOPIARY_SHAPES.map(TRIM_TOPIARY), ...HEDGE_CLIPS.map(CLIP_HEDGE), PRUNE_BONSAI, SHOW_THING, TAKE_SHOWN,
];

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target, is: (d: FurnitureDef) => boolean): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && is(furnitureDef(f.kind)) ? f : undefined;
};
const nameOf = (f: PlacedFurniture): string => furnitureDef(f.kind).name.toLowerCase();

/** Whether a thing in the pack is a trophy (`ItemDef.trophy`), and one a plaque or a stand takes. */
export const isTrophy = (id: string): boolean => !!ITEM_DEFS[id]?.trophy;
export const showTakes = (def: FurnitureDef, id: string): boolean =>
  (def.shows?.what === 'trophy' ? isTrophy(id) : def.shows?.what === 'pot' ? POTS.includes(id) : false);
/** The thing in the pack a Hang or a Set would put up: the one named, or the first the piece takes. */
const toShow = (g: Game, f: PlacedFurniture, t: Target): { uid: number; id: string } | undefined => {
  const def = furnitureDef(f.kind);
  const uid = (t as { itemUid?: number }).itemUid;
  const named = uid !== undefined ? g.inventory.get(uid) : undefined;
  if (named && showTakes(def, named.id)) return named;
  return g.inventory.items.find((it) => showTakes(def, it.id));
};

/**
 * Why a job at a garden piece cannot be done now, or null: in the island's
 * order -- there, in reach, the tool, and then the piece (`garden_refusal`).
 */
export function gardenRefusal(g: Game, id: string, t: Target): string | null {
  const f = pieceOf(g, t, isGardenPiece);
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(nameOf(f));
  const def = furnitureDef(f.kind);
  const gd = f.garden ?? {};
  const now = g.wallNow();
  const name = nameOf(f);
  if (id.startsWith('plant_') && id.endsWith('_flowers')) {
    if ((gd.bloom ?? []).length >= (def.bloom ?? 0)) return gardenSaid('full', name);
    return g.inventory.count('wildflowers') >= BLOOM_COST ? null : GARDEN_SAID.flowers;
  }
  if (id === CLEAR_BLOOMS) return (gd.bloom ?? []).length ? null : GARDEN_SAID.noFlowers;
  if (id.startsWith('trim_topiary_')) return g.inventory.has(TRIM_TOOL) ? null : GARDEN_SAID.trimTool;
  if (id.startsWith('clip_hedge_')) {
    if (!g.inventory.has(TRIM_TOOL)) return GARDEN_SAID.trimTool;
    if (hedgeGrowth(f.setAt, now) < 1) return GARDEN_SAID.hedgeYoung;
    return gd.clip === id.slice('clip_hedge_'.length) ? GARDEN_SAID.clipped : null;
  }
  if (id === PRUNE_BONSAI) {
    if (!g.inventory.has(PRUNE_TOOL)) return GARDEN_SAID.pruneTool;
    if ((gd.prunes ?? 0) >= BONSAI_STEPS) return GARDEN_SAID.shaped;
    return gd.pruneAt !== undefined && now - gd.pruneAt < PRUNE_REST * DAY ? GARDEN_SAID.pruned : null;
  }
  // What is on show is changed by whoever set the piece down, or a citizen of its settlement (`may_engrave`).
  if ((id === SHOW_THING || id === TAKE_SHOWN) && f.mine === false && !g.onDeed(f.x, f.y)) return GARDEN_SAID.notYours;
  if (id === SHOW_THING) {
    if ((gd.held ?? []).length >= (def.shows?.n ?? 0)) return gardenSaid('full', name);
    return toShow(g, f, t) ? null : def.shows?.what === 'trophy' ? GARDEN_SAID.noTrophy : GARDEN_SAID.noPot;
  }
  if (id === TAKE_SHOWN) return (gd.held ?? []).length ? null : GARDEN_SAID.nothingShown;
  return null;
}

const job = (o: Omit<ActionDef, 'perform' | 'check' | 'stamina'> & { stamina?: number }): ActionDef => ({
  stamina: 0.02,
  ...o,
  check: (t, g) => gardenRefusal(g, o.id, t),
  // The island's (`perform_garden`).
  perform: () => undefined,
});

export const GARDEN_ACTIONS: ActionDef[] = [
  ...BLOOM_KINDS.map((k) => job({
    id: PLANT_BLOOM(k), label: `Plant ${k} wildflowers`, verb: 'planting wildflowers', skill: BLOOM_SKILL, baseTime: BLOOM_TIME,
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.bloom),
  })),
  job({
    id: CLEAR_BLOOMS, label: 'Pull up flowers', verb: 'pulling up the flowers', skill: BLOOM_SKILL, baseTime: CLEAR_TIME,
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.bloom)?.garden?.bloom?.length,
  }),
  ...TOPIARY_SHAPES.map((s) => job({
    id: TRIM_TOPIARY(s), label: `Trim into a ${SHAPE_WORD[s]}`, verb: 'trimming the shrub', skill: TRIM_SKILL, tool: TRIM_TOOL, baseTime: TRIM_TIME, stamina: 0.03,
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.topiary),
  })),
  ...HEDGE_CLIPS.map((c) => job({
    id: CLIP_HEDGE(c), label: `Clip ${CLIP_WORD[c]}`, verb: 'clipping the hedge', skill: TRIM_SKILL, tool: TRIM_TOOL, baseTime: CLIP_TIME, stamina: 0.03,
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.hedge),
  })),
  job({
    id: PRUNE_BONSAI, label: 'Prune', verb: 'pruning the bonsai', skill: PRUNE_SKILL, tool: PRUNE_TOOL, baseTime: PRUNE_TIME,
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.bonsai),
  }),
  job({
    id: SHOW_THING, label: 'Put on show', verb: 'putting it up', baseTime: SHOW_TIME,
    labelFor: (t, g) => {
      const f = pieceOf(g, t, (d) => !!d.shows);
      const it = f && toShow(g, f, t);
      const what = furnitureDef(f?.kind ?? '').shows?.what;
      return `${what === 'trophy' ? 'Hang' : 'Set down'} ${it ? wordOf(it.id) : what === 'trophy' ? 'a trophy' : 'a potted plant'}`;
    },
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.shows),
  }),
  job({
    id: TAKE_SHOWN, label: 'Take down', verb: 'taking it down', baseTime: SHOW_TIME,
    labelFor: (t, g) => {
      const held = pieceOf(g, t, (d) => !!d.shows)?.garden?.held ?? [];
      return held.length ? `Take down ${wordOf(held[held.length - 1].def)}` : 'Take down';
    },
    applies: (t, g) => !!pieceOf(g, t, (d) => !!d.shows)?.garden?.held?.length,
  }),
];

/* ---- a carved figure's kind ----------------------------------------------------------------- */

/** The kinds a carved figure may be carved as, in the field guide's order: every kind with a page. */
export const FIGURE_KINDS = (): string[] => guidePages().map((d) => d.id);
export { FIGURE_SAID, figureRefusal } from './gardendefs';

/* ---- what is fixed to a wall, and where ------------------------------------------------------ */

/**
 * What each way of being fixed says, for its item and the help, and why a
 * place will not take it (`mount_refusal` on the island).
 */
export const MOUNT_SAID = {
  get window(): string { return mountWords('window', trellisWallWords(), ''); },
  get wall(): string { return mountWords('wall', trellisWallWords(), ''); },
  get hang(): string { return mountWords('hang', trellisWallWords(), listedOr(HANG_FROM.map(wordOf))); },
  noWindow: 'No window on that side.',
  noWall: 'No solid wall on that side.',
  unfinished: 'Wall not finished.',
  inside: 'Inside a building.',
  upstairs: 'Ground level only.',
  noHook: 'No eave or post to hang it from.',
  turn: 'No other side of this tile takes it.',
};

/* ---- descriptions ------------------------------------------------------------------------ */

const bloomRule = (n: number): string =>
  `Holds ${n} wildflower kinds (${listed([...BLOOM_KINDS])}), ${BLOOM_COST} wildflowers a kind, chosen as each is planted. `
  + `Leaf ${days(ROSE_LEAFY)} after it is set down, bud after ${ROSE_BUD} days, flower after ${ROSE_FLOWER} days, in ${listed(ROSE_SEASONS)}; leaf the rest of the year.`;
for (const d of FURNITURE) {
  if (d.bloom) describeFrom(d.id, { rule: bloomRule(d.bloom) });
  if (d.mount) describeFrom(d.id, { where: MOUNT_SAID[d.mount] });
}
describeFrom(HERB_BOX, { share: HERB_SHARE, herbs: listed(CROP_LIST.filter((c) => c.kind === 'spice').map((c) => c.name.toLowerCase())) });
describeFrom('topiary_tub', { shapes: listed(TOPIARY_SHAPES.map((s) => SHAPE_WORD[s])), out: days(TOPIARY_GROWS_OUT), tool: wordOf(TRIM_TOOL), skill: TRIM_SKILL });
describeFrom('hedge', { full: days(HEDGE_FULL), clips: listedOr(HEDGE_CLIPS.map((c) => CLIP_WORD[c])), tool: wordOf(TRIM_TOOL), across: SUBTILES });
describeFrom('bonsai', { grown: days(BONSAI_GROWN), steps: BONSAI_STEPS, rest: days(PRUNE_REST), tool: wordOf(PRUNE_TOOL) });
describeFrom('birdhouse', { most: BIRDS_MOST, away: listed([...BIRDS_AWAY]) });
describeFrom('wind_chime', { still: Math.round(CHIME_STILL * 100) });
describeFrom(CARVED_FIGURE, { kinds: guidePages().length });
describeFrom('wisteria_pergola', { name: CLIMBER_NAME.wisteria });
describeFrom('trophy_plaque', { holds: furnitureDef('trophy_plaque').shows?.n });
describeFrom('plant_stand', { holds: furnitureDef('plant_stand').shows?.n, pots: listed(POTS.map(wordOf)) });

/**
 * Why a piece fixed in this way will not go on tile (x, y) against its side
 * `facing`, from storey `level`, or null: in the island's order
 * (`mount_refusal`). A hung piece hangs from a lantern post, a lantern pillar
 * or a flagpole on its tile, at any storey; else from an eave, as a window
 * box goes under a window: from the ground, outside a building, against the
 * outer face of a finished wall of the right type on that side. A plaque goes
 * on either face of a finished solid wall on that side, on its storey.
 */
export function mountRefusal(g: Game, mount: Mount, x: number, y: number, facing: Side, level: number): string | null {
  if (mount === 'wall') {
    const w = g.buildings.wall(level, x, y, facing);
    if (!w || g.buildings.seenType(w) !== 'solid') return MOUNT_SAID.noWall;
    return isDone(w) ? null : MOUNT_SAID.unfinished;
  }
  if (mount === 'hang' && g.furnitureOnTile(x, y).some((f) => HANG_FROM.includes(f.kind) && (f.level ?? 0) === level)) return null;
  const miss = mount === 'window' ? MOUNT_SAID.noWindow : MOUNT_SAID.noHook;
  if (level !== 0) return mount === 'window' ? MOUNT_SAID.upstairs : miss;
  if (g.buildings.buildingAt(x, y)) return mount === 'window' ? MOUNT_SAID.inside : miss;
  const w = g.buildings.wall(0, x, y, facing);
  if (!w) return miss;
  const seen = g.buildings.seenType(w);
  if (mount === 'window' ? seen !== 'window' : !WALL_TYPE_BY_ID.get(seen)?.trellis) return miss;
  return isDone(w) ? null : MOUNT_SAID.unfinished;
}

/** Why a hedge will not go on tile (x, y) from storey `level`, or null: from the ground, outside a building (`hedge_refusal`). */
export function hedgeRefusal(g: Game, x: number, y: number, level: number): string | null {
  if (level !== 0) return MOUNT_SAID.upstairs;
  return g.buildings.buildingAt(x, y) ? MOUNT_SAID.inside : null;
}

/** The side a fixed piece goes round to on a turn: the next to the right it may be fixed on, or null where none other may (`mount_turns_to`). */
export function mountTurnsTo(g: Game, f: PlacedFurniture): Side | null {
  const mount = furnitureDef(f.kind).mount;
  if (!mount) return null;
  let facing = facingOf(f);
  for (let i = 0; i < FACINGS.length - 1; i++) {
    facing = turnedFacing(facing, 1);
    if (!mountRefusal(g, mount, f.x, f.y, facing, f.level ?? 0)) return facing;
  }
  return null;
}
