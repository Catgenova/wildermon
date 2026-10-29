import type { Bill } from '../game/building';
import { drawsFast } from '../game/settings';
import { onPhone } from '../engine/device';
import type { Pointer } from '../engine/input';
import { buildRow } from './buildCounts';
import type { Game } from '../game/game';
import { EMOTES } from '../game/emotes';
import type { Pick, Renderer } from '../render/renderer';
import { TileType, TREE_DEFS, treeAge, treeSpecies, SLAB_BY_ITEM } from '../world/tiles';
import { ACTION_BY_ID, type ActionDef, type Target, fruitSprout, SPOIL_ORDER } from '../game/actions';
import { BARTER_REACH, BARTER_SAID } from '../game/barter';
import { BUILD_ACTION_BY_ID, layingBill, materialName } from '../game/buildActions';
import {
  describeNeeds,
  FENCE_TYPES,
  floorName,
  SINGLE_STAIRS_NAME,
  SPIRAL,
  SPIRAL_STAIRS_NAME,
  type StairHand,
  floorBill,
  floorKind,
  GLASS_ROOF,
  heftWord,
  MATERIAL_BY_ID,
  isDone,
  MATERIALS,
  takesAs,
  progressOf,
  ROOF_SHAPES,
  roofShapeOf,
  roofShapeDef,
  SIDE_NAMES,
  wallBill,
  WALL_TYPE_BY_ID,
  WALL_TYPES,
  CELLAR_DEPTH,
  CELLAR_LEVEL,
  borderOf,
  NO_PLAN_FROM,
  type Building,
  type RoofShape,
  type Side,
  type WallType,
} from '../game/building';
import { deckBill, metres, pierDrop } from '../game/piers';
import { cellarGate, targetFloor } from '../game/cellar';
import { GEAR_SLOTS } from '../game/wildgear';
import { fitGearId, removeGearId } from '../game/wildgearActions';
import { ARTIFACT_FOR, baitHint, CREATURE_ACTION_BY_ID, feedable, vehicleFor } from '../game/creatureActions';
import { FIELD_GLASS_ONLY, glassDone, glazing, isGlasshouse, underGlass } from '../game/glasshouse';
import { GLASSHOUSE_GROWTH } from '../game/growth';
import { crateLine, crateOf, CREATURE_CRATE, CREATURE_CRATE_ACTION_BY_ID, occupiedRefusal } from '../game/creaturecrate';
import { graveLine, graveName, graveSays, graveUnits, isGrave } from '../game/graves';
import { COMPANION_STANCES, isBaitFor, SPECIES, tameNeeds, STANCE_HINTS, STANCE_NAMES, GATHER_VERB, GATHER_DO } from '../game/creatures';
import { itemDef, itemName, markOf, storedLine, type Item } from '../game/items';
import { nearestSide } from '../render/renderer';
import { crateHolds, crateKindOfItem, crateName, crateCapacity, crateUnits, rackSpotOf, subtileOf } from '../game/crates';
import { trellisFacing } from '../game/vineyard';
import { butcherPreview } from '../game/butcher';
import { anvilAnchor, anvilName, type PlacedAnvil } from '../game/anvil';
import { postCandidates, postKeep, postLife, postName, postRadius, postState, type PlacedPost } from '../game/posts';
import { baitInPack, creelHold, trapDef, trapHolds, trapKeep, trapLife, trapName, TRAPS, trapState, type PlacedTrap } from '../game/traps';
import { BAIT_BY_ID } from '../game/fishing';
import { BRIDGES, bridgeDef, bridgeDone, bridgeName, bridgeState, isMaterialBridge, laneSide, spanWants, STALL_WIDTH, THROWN, WAGON_WIDTH, type Bridge } from '../game/bridges';
import { aqueductEntries, aqueductMenu } from './aqueducts';
import { drawbridgeState, fitsMaterial, gateHoverLine, gatePlanRefusal, hiddenDoorIronWords, hiddenDoorWants, isDrawbridge, planHiddenDoor, portcullisAt, portcullisState } from '../game/gates';
import { foundationState } from '../game/foundations';
import { BLESS_CAP, CASTS, FAITH, favourCap } from '../game/faith';
import { BAUBLE_SAID, BAUBLE_TIER_BY_ID, BAUBLE_TIERS, readBauble, socketsOf, socketText, TARNISHED } from '../game/baubles';
import { FED_SAID, SACRIFICE_SAID, sacrificeable } from '../game/sacrifice';
import { abilitiesOf, CHOOSE_AT, MEDITATION, nextStep, PATH_PICK_BY_ID, PATH_TIER_AT, PATHS, PATH_LIST, picksOf, sittingWorth } from '../game/meditation';
import { canImprove } from '../game/improve';
import { BREWS } from '../game/brewing';
import { fireAnchor, fireState, FIRE_COST, isFuel, type PlacedCampfire } from '../game/campfire';
import { COIN_METALS, COIN_REFUSAL, DIE_WEAR, INGOT_LUMPS, MOULD_BY_ID, MOULD_BY_MAKES, isCasting, isIngot, isLump, isMetalStock, isMould, isOreItem, lumpsIn, metalOfBar, mouldLumps, mouldUsesLeft } from '../game/metal';
import { meltable } from '../game/melt';
import { jobName, smelterAnchor, smelterState, type PlacedSmelter } from '../game/smelter';
import { isGreenware, kilnAnchor, kilnState, type PlacedKiln } from '../game/kiln';
import { furnitureAnchor, furnitureCapacity, furnitureDef, furnitureHeft, furnitureHolds, furnitureKg, furnitureName, furnitureState, furnitureUnits, isFurniture, isPlanter, rackDeck, rackSpots, type PlacedFurniture, teamOf, turnedFacing, vehicleOf } from '../game/furniture';
import { DEED_ACTION_BY_ID, joinFromAfar, leaveQuestion, standingWord, upgradeProgress, upgradeReason } from '../game/deed';
import { CROP_BY_SEED, cropDef, cropReady, describeCrop, emptyFields, planterPace, sownPace, stageNote, type Crop, type CropDef } from '../game/farming';
import { PLANTER_GROWTH } from '../game/growth';
import { describeWaterPlant } from '../game/watergarden';
import { swirlName } from '../game/motes';
import { runestoneAt } from '../game/runestones';
import { cornerReading, groundReading, yieldLines } from './tileinfo';
import { deedWorkersAt, MAX_DEED_LEVEL, type Deed } from '../game/game';
import { isFounder, lacks } from '../game/ranks';
import { CRAFT_REACH, reachFor, RECIPE_BY_ID, recipeNeeds, recipeReason, recipeStatus, RECIPES, skillName, type CraftStock, type Recipe } from '../game/recipes';
import { CraftPanel } from './panels/craft';
import { unseenNews } from './panels/news';
import { CratePanel } from './panels/crate';
import { counterEntries, counterTip, dropOnCounter, type CounterWays } from './counterMenu';
import { lampEntries } from './lampMenu';
import { isLampPiece, lampState } from '../game/lamps';
import { boughtLine, COUNTER_SEEN, COUNTER_TOO_FAR_TO_SEE, stallBuyRefusal } from '../game/counters';
import { priceWords } from '../game/money';
import { TilePanel } from './panels/tile';
import type { DragPayload } from './dragdrop';
import { WildermonPanel } from './panels/wildermon';
import { StoresPanel } from './panels/stores';
import { DeedPanel, ORDER_HINTS } from './panels/deed';
import { ORDER_STANCES } from '../game/visitors';
import { DELIVER_REACH, settleLine } from '../game/noticeboard';
import type { LedgerPanel } from './panels/ledger';
import { JournalPanel, type JournalTab } from './panels/journal';
import { ContextMenu, type MenuItem } from './contextmenu';
import { AutoEat } from '../game/autoeat';
import { ShoppingPanel } from './panels/shopping';
import { rotLine, rotSaid, rotSeconds } from '../game/rot';
import { frameFootprintEntries, frameHoverLines, frameJettyEntries, frameRoofEntries } from './frameMenu';
import { storeyHost } from '../game/storeyview';
import { areaAsk, areaCount, areaPieces, areaRefusals, areaTotals, passing, PLAN_UNDO_SECONDS, UNDONE_PLANS, type AreaPlan, type AreaPiece } from '../game/planarea';
import { PlanBar } from './planbar';
import { jobEntry, pinEntry, pinnable } from './beltmenu';
import { creatureLines } from './creatureinfo';
import { MARK_COLOURS } from '../game/marks';
import { SettingsPanel } from './panels/settings';
import { Palette, type PaletteEntry } from './palette';
import { compareLines, itemCard } from './compare';
import { orderBy } from './sorting';
import { priceLine } from '../game/prices';
import { Notices } from './notices';
import { PointerRing } from './pointerring';
import { DeedBanner } from './deedbanner';
import type { HelpPages } from './panels/help';
import { BINDS, keyName, type Keybinds } from '../game/keybinds';
import { Hud, WINDOWS } from './hud';
import { EventLogPanel } from './panels/eventlog';
import { InventoryPanel } from './panels/inventory';
import { MinimapPanel } from './panels/minimap';
import { SkillsPanel } from './panels/skills';
import { HealthPanel } from './panels/health';
import { EquipmentPanel } from './panels/equipment';
import { TradesPanel } from './panels/trades';
import { FaithPanel } from './panels/faith';
import { FaithBook } from './faithbook';
import { SpellBar, type SpellAim } from './spellbar';
import { defsOf, inviteDeeds, inviteRefusal, SocialPanel } from './panels/social';
import { MarketPanel } from './panels/market';
import { BoardsPanel } from './panels/boards';
import { GuidePanel } from './panels/guide';
import { HoardPanel } from './panels/hoard';
import { BarterPanel } from './panels/barter';
import { KeeperPanel } from './panels/keeper';
import { TrackerPanel } from './panels/tracker';
import { Tooltip } from './tooltip';
import { LAYOUT_SLOTS, WindowManager, type UIWindow } from './windows';
import { CELL } from './snapgrid';
import { seasonAt } from '../world/calendar';
import type { Island } from '../net/island';
import { awayLines } from '../game/away';
import { clearQuestion, REPORT_NOTE_MAX, REPORT_REASONS, REPORTS_A_DAY } from '../game/keeper';
import { uiBox } from './screen';
import { capital } from '../game/words';
import { applyLook, runeFor } from './theme';
import { RunecutArt } from './runecut-dress';
import { FRAME_RIM, RIMS } from './runecut-art';

export interface UICallbacks {
  /** Quarter-turn the camera: +1 or -1. */
  turn: (step: number) => void;
  /** What every key does, for the Keys tab in Settings to write to. */
  keys: Keybinds;
  /**
   * The island, when there is one.
   *
   * The only thing in here that talks to it directly. Everything else on this
   * canvas asks the game and the game asks the island — but who somebody is to
   * you is not a fact about the world being drawn: there is no wildermon, no
   * tile and no item behind a friend, only a door and an answer.
   */
  island?: Island | null;
}

/** A phone's folded event log's rim, in interface pixels: its bar is one line high. */
const PHONE_FOLD_RIM = 4;

/** Builds and updates every HTML overlay above the canvas. */
/** Why a job cannot be done just now, as the game will answer it: down in a cellar or up top first (`cellarGate`), then the job's own say. */
const cellarReason = (g: Game, def: ActionDef, t: Target): string | null => cellarGate(g, def.id, t) ?? def.check?.(t, g) ?? null;

/**
 * Raising and lowering a portcullis on the side of a tile, and its padlock
 * (`gates.ts`): whatever of them applies, each with its reason when it
 * cannot be done. Asked of the game alone, as every row of a tile's menu can
 * be.
 */
function gateEntries(g: Game, t: Extract<Target, { kind: 'tile' }>): MenuItem[] {
  const out: MenuItem[] = [];
  // Where it stands, as a drawbridge's menu says where that does.
  const port = portcullisAt(g, t);
  if (port && isDone(port)) out.push({ label: capital(portcullisState(port)), disabled: true });
  for (const id of ['raise_portcullis', 'lower_portcullis', 'fit_lock', 'take_off_lock']) {
    const a = ACTION_BY_ID.get(id);
    if (!a || !a.applies(t, g)) continue;
    const reason = a.check?.(t, g) ?? null;
    out.push({ label: `${a.labelFor?.(t, g) ?? a.label} (${SIDE_NAMES[t.side ?? 'n']})`, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(a, t) });
  }
  return out;
}

/**
 * The way down to the cellar under a tile, from its ground floor: planned
 * (a staircase in any material, or a ladder, the side to climb from turned
 * with Q and E, `place` starting it), built, and taken out. Only over a
 * cellar tile.
 */
/** What Q and E do to a single staircase being placed (`rotatePlacing`). */
const SINGLE_TURNS = 'Q/E: climbing side and tile half';

/**
 * The row for a spiral staircase on a tile (`label`): barred with the refusal
 * where it is barred, else its materials, each with its bill, planned on the
 * tile with no side to choose (`place`).
 */
export function spiralRow(g: Game, t: Extract<Target, { kind: 'tile' }>, label: string, place: (material: string) => void): MenuItem[] {
  const plan = ACTION_BY_ID.get('plan_floor');
  if (!plan) return [];
  const why = cellarReason(g, plan, { ...t, material: 'log', floorKind: 'stairs', hand: SPIRAL });
  if (why) return [{ label, hint: why, disabled: true }];
  return [{
    label,
    children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => {
      const why = cellarReason(g, plan, { ...t, material: m.id, floorKind: 'stairs', hand: SPIRAL });
      if (why) return { label: m.name, hint: why, disabled: true };
      return { label: m.name, note: describeNeeds(floorBill(m.id, 'stairs', undefined, SPIRAL), materialName), onSelect: () => place(m.id) };
    }),
  }];
}

function cellarEntries(g: Game, base: Extract<Target, { kind: 'tile' }>, side: Side, place: (material: string, kind: 'stairs' | 'ladder', hand?: StairHand) => void): MenuItem[] {
  const bld = g.buildings;
  if (!bld.cellar(base.x, base.y)) return [];
  const entries: MenuItem[] = [];
  // As every other building job is offered: once, barred with the refusal where it is barred.
  const item = (def: ActionDef | undefined, t: Target, label: string): MenuItem[] => {
    if (!def) return [];
    const reason = cellarReason(g, def, t);
    return [{ label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, t) }];
  };
  const flight = bld.floor(0, base.x, base.y);
  const kind = flight ? floorKind(flight) : null;
  if (flight && (kind === 'stairs' || kind === 'ladder')) {
    const t: Target = { ...base, floorKind: kind, down: true };
    const what = `${floorName(flight)} down`;
    const build = ACTION_BY_ID.get('build_floor');
    if (!isDone(flight) && build) entries.push(buildRow(g, build, t, `Build ${what} · needs ${describeNeeds(flight, materialName)}`, flight, cellarReason(g, build, t)));
    entries.push(...item(ACTION_BY_ID.get('remove_floor'), t, `Remove ${what}`));
    return entries;
  }
  const plan = ACTION_BY_ID.get('plan_floor');
  if (!plan) return [];
  // A spiral staircase down has no side to choose, and comes down on its own tile.
  const spiral = spiralRow(g, { ...base, down: true }, `Plan ${SPIRAL_STAIRS_NAME} down`, (material) => place(material, 'stairs', SPIRAL));
  // Which side it is climbed from is chosen as it is placed: barred only when no side will do, with the
  // refusal for the side the cursor is nearest unless another side's says more.
  const said = (['n', 'e', 's', 'w'] as Side[]).map((sd) => cellarReason(g, plan, { ...base, side: sd, material: 'log', floorKind: 'stairs', down: true }));
  if (said.every((r) => r !== null)) {
    const foot = (r: string | null): boolean => !!r && /^Its foot would come down/.test(r);
    const here = said[['n', 'e', 's', 'w'].indexOf(side)];
    const why = (foot(here) ? said.find((r) => !foot(r)) : undefined) ?? here ?? '';
    entries.push({ label: 'Plan staircase down', hint: why, disabled: true });
    entries.push({ label: `Plan ${SINGLE_STAIRS_NAME} down`, hint: why, disabled: true });
    entries.push({ label: 'Plan ladder down', hint: why, disabled: true });
    entries.push(...spiral);
    return entries;
  }
  entries.push({
    label: 'Plan staircase down',
    children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
      label: m.name,
      note: `${describeNeeds(floorBill(m.id, 'stairs'), materialName)} · Q/E: side`,
      onSelect: () => place(m.id, 'stairs'),
    })),
  });
  entries.push({
    label: `Plan ${SINGLE_STAIRS_NAME} down`,
    children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
      label: m.name,
      note: `${describeNeeds(floorBill(m.id, 'stairs', undefined, 'l'), materialName)} · ${SINGLE_TURNS}`,
      onSelect: () => place(m.id, 'stairs', 'l'),
    })),
  });
  entries.push({
    label: 'Plan ladder down',
    note: `${describeNeeds(floorBill('plank', 'ladder'), materialName)} · Q/E: side`,
    onSelect: () => place('plank', 'ladder'),
  });
  entries.push(...spiral);
  return entries;
}

/**
 * Something on its way to the ground. A piece of furniture follows the cursor
 * until it is clicked down; a staircase or a ladder sits on its tile until
 * the side to climb from is chosen. Q and E turn either.
 */
type Placing =
  | { kind: 'furniture'; itemUid: number; piece: string; material?: string; facing: Side }
  | { kind: 'stairs'; x: number; y: number; cx: number; cy: number; level: number; material: string; floorKind: 'stairs' | 'ladder'; side: Side; down?: boolean; hand?: StairHand; buildingId?: number }
  /** A plan over an area (`planarea.ts`): its ghost and its totals while it is laid out, a click plans it. */
  | { kind: 'area'; plan: AreaPlan };

/**
 * Where a stack at hand is, on its menu row, when it is not on you: "in the
 * wagon (pine)". A station takes what it uses up from your stores within
 * `CRAFT_REACH` as well as from the pack, and says so here.
 */
const storedIn = (s: CraftStock): string | undefined =>
  s.carried || !s.store ? undefined : `in the ${s.store.charAt(0).toLowerCase()}${s.store.slice(1)}`;
/**
 * A stack of metal off a smelter's or an anvil's menu: its metal and how much
 * of it, and for ingots how many lumps they count as (a Smith's Ingots).
 */
const metalLabel = (it: Item): string =>
  (isIngot(it.id)
    ? `${itemName(it)} (${it.count}, ${lumpsIn(it)} lumps)`
    : `${metalOfBar(it.id)?.name ?? itemName(it)} (${it.count})`) + ` · QL ${it.ql.toFixed(1)}`;
/**
 * The account page opened at its character creator, carrying the island this
 * page is on so that stepping ashore there comes back to it.
 */
function creatorPage(): string {
  const go = new URLSearchParams({ look: '1' });
  const island = new URLSearchParams(location.search).get('island');
  if (island !== null) go.set('island', island);
  return `./account.html?${go}`;
}

/** What a station's menu says when nothing it takes is at hand: on you, and in your stores too unless Settings keeps them out. */
const noneAtHand = (g: Game, what: string, reach = CRAFT_REACH): string =>
  g.settings.fromStores ? `Have ${what} (carried or in stores within ${reach} tiles).` : `Have ${what} (carried).`;

export class UI {
  readonly windows: WindowManager;
  readonly menu: ContextMenu;
  readonly tooltip: Tooltip;
  /** Runecut's stone, niches and frames on the windows, the HUD and the toolbar. */
  private readonly art: RunecutArt;
  readonly hud: Hud;
  readonly minimap: MinimapPanel;
  private readonly eventLog: EventLogPanel;
  private readonly settings: SettingsPanel;
  private readonly cratePanel: CratePanel;
  private readonly wildermon: WildermonPanel;
  private readonly stores: StoresPanel;
  private readonly craftPanel: CraftPanel;
  private readonly ledgerPanel: LedgerPanel;
  private readonly journalPanel: JournalPanel;
  private readonly trades: TradesPanel;
  /** Your faith as the island keeps it, which the Faith window and the spell bar both draw. */
  private readonly faithBook: FaithBook;
  private readonly faith: FaithPanel;
  private readonly health: HealthPanel;
  private readonly equipment: EquipmentPanel;
  private readonly shopping: ShoppingPanel;
  private readonly spellBar: SpellBar;
  private readonly deedPanel: DeedPanel;
  private readonly tilePanel: TilePanel;
  private readonly social: SocialPanel;
  private readonly market: MarketPanel;
  private readonly boards: BoardsPanel;
  private readonly guide: GuidePanel;
  private readonly tracker: TrackerPanel;
  private readonly hoard: HoardPanel;
  /** A trade between you and one other person, opened when one is asked for or stands. */
  private readonly barter: BarterPanel;
  /**
   * The Island keeper window, made only once the island has said this body
   * keeps it. Null for everybody else, and in the game played alone, and then
   * neither the window, its row on the Menu, its key nor clearing a pile exist.
   */
  private keeper: KeeperPanel | null = null;
  /** The island, for the one window that asks it things directly. */
  private readonly island: Island | null;
  /** What every key does, so the window menu can name them. */
  private readonly keys: Keybinds;
  /** Something on its way to the ground, or nothing. */
  placing: Placing | null = null;
  /** The bar under a plan over an area: its totals and Plan while it is laid out, then Undo (`planbar.ts`). */
  readonly planBar: PlanBar;
  /** The pieces of the plan over an area laid out just now, as the ghost last drew them. */
  private areaLaid: AreaPiece[] = [];
  /** A plan over an area asked for from out of reach of it: sent once the feet are beside a piece of it (`areaArrived`). */
  private areaPending: { plan: AreaPlan; asks: ReturnType<typeof areaAsk> } | null = null;
  /** Lines near the top of the screen for a new whole number, a knack, work done or a birth. */
  readonly notices: Notices;
  /** Eating by itself when Food runs low (`settings.autoEat`). */
  private readonly autoEat: AutoEat;
  /** The job in hand as a ring round the mouse pointer (`pointerring.ts`). */
  private readonly pointerRing: PointerRing;
  /** A settlement's name as you cross into it (`deedbanner.ts`). */
  private readonly deedBanner: DeedBanner;
  /** Find anything (`palette`, Ctrl+K). */
  private readonly palette: Palette;
  /** The help, built into its window the first time anything asks for it. */
  private helpBuilt: Promise<HelpPages> | null = null;
  /** The help's section headings, once it has been built. */
  private helpTitles: string[] = [];
  /** What a key does, by its binding's id, for the Find anything box to do the same. Set by `main`. */
  presses: Record<string, () => void> = {};

  constructor(
    private readonly game: Game,
    private readonly renderer: Renderer,
    root: HTMLElement,
    canvas: HTMLCanvasElement,
    cb: UICallbacks,
  ) {
    this.keys = cb.keys;
    this.island = cb.island ?? null;
    this.windows = new WindowManager(root);
    // Every window as it is made is dressed in Runecut's stone, its niche and its frame; menus, tooltips, notices and the palette are there for a moment and stay plain.
    this.art = new RunecutArt(root);
    // A window's rim is narrower on a phone's screen, where every pixel across counts, and wider in a bulky frame (`FRAME_RIM`).
    // And on a phone's folded log, one line high, thinner again (`PHONE_FOLD_RIM`).
    const rim = (kind: string, win?: UIWindow): number =>
      win?.folds && win.isFolded && root.classList.contains('phone') ? PHONE_FOLD_RIM : root.classList.contains('narrow') ? RIMS.phone : FRAME_RIM[kind] ?? RIMS.window;
    this.windows.onCreate = (win) => this.art.add(win.opts.id, win.el, (kind) => rim(kind, win), runeFor(win.opts.id));
    this.menu = new ContextMenu(root, canvas);
    this.planBar = new PlanBar(root, { plan: () => void this.commitPlanArea(), cancel: () => this.cancelPlacing(), undo: () => void this.undoPlan() });
    this.tooltip = new Tooltip(root);
    this.hud = new Hud(root, game, {
      toggle: (id) => this.toggleWindow(id),
      toggleGrid: () => (game.settings.grid = !game.settings.grid),
      center: () => (renderer.camera.follow = true),
      windows: (x, y) => this.showWindowMenu(x, y),
      turn: cb.turn,
      useLoop: (loop) => this.useLoop(loop),
      numbersTaken: () => this.numbersTaken,
      keys: cb.keys,
      tooltip: this.tooltip,
    });
    /*
     * One place hears about a rebinding and tells the rest. The Keys tab redraws
     * its own rows; the toolbar has to be told, because the button that says
     * `Inventory I` is not the thing that changed it.
     */
    // The HUD and the toolbar are slabs too, in a strap and a tool belt; and on the grid with the windows, moved but never resized or closed.
    for (const [id, sel] of [['hud', '.hud-status'], ['toolbar', '.toolbar']] as const) {
      const el = root.querySelector<HTMLElement>(sel);
      if (!el) continue;
      this.art.add(id, el, () => RIMS[id]);
      // The first time: the status panel a cell in from the top left, the toolbar a cell down in the middle.
      this.windows.addBar(id, el, (b) => (id === 'hud' ? { x: CELL, y: CELL } : { x: (uiBox().w - b.w) / 2, y: CELL }));
    }
    this.windows.onSeams = (seams, joins, fresh, shown) => this.art.seams(seams, joins, fresh, shown);
    // The life on the frames (`src/ui/runecut-life.ts`): wanted unless turned off, with Fast graphics or on a phone's screen; and what the island says to it.
    this.art.lifeOn = () => game.settings.uiLife && !drawsFast(game.settings, onPhone()) && !root.classList.contains('narrow');
    this.art.lifeWorld = () => {
      const a = game.action;
      return {
        winter: seasonAt(game.wallNow()).season === 'winter',
        crafting: !!a && a.state === 'performing' && RECIPE_BY_ID.has(a.def.id),
        favour: game.player.favour / Math.max(1, favourCap(game.skills.get(FAITH))),
        map: game.inventory.items.some((it) => it.id === 'treasure_map'),
      };
    };
    cb.keys.onChange = () => {
      this.hud.drawKeys();
      this.settings.drawKeys();
      this.settings.drawLayouts();
    };

    const events = this.windows.create({ id: 'events', title: 'Event', x: 12, y: 12, width: 420, height: 210, anchor: 'bl', seeThrough: true, fold: true });
    this.eventLog = new EventLogPanel(events, game);
    // On a phone, opened from its bar at the newest line.
    events.onFold = (folded) => {
      const list = events.body.querySelector<HTMLElement>('.log-list');
      if (!folded && list) list.scrollTop = list.scrollHeight;
    };
    const inventory = this.windows.create({ id: 'inventory', title: 'Inventory', x: 12, y: 56, width: 340, height: 396, anchor: 'tr' });
    new InventoryPanel(inventory, game, this.menu, (p) => this.moveDragged(p, 'inventory'), (uid) => this.cratePanel.openBag(uid), (uid) => this.hoard.openOn(uid),
      (uid) => this.spellBar?.entriesFor({ kind: 'item', id: uid }) ?? [],
      (item) => {
        const e = this.cratePanel?.putKindEntry(item);
        return e ? [e] : [];
      },
      (item, x, y) => this.compareCard(item, x, y),
      () => this.cratePanel?.pickedTo((uid) => {
        const it = game.inventory.get(uid);
        if (it) this.moveDraggedN({ uid, from: 'inventory', name: itemName(it) }, 'store');
      }) ?? null);
    const skills = this.windows.create({ id: 'skills', title: 'Skills', x: 364, y: 56, width: 260, height: 380, anchor: 'tr', open: false });
    new SkillsPanel(skills, game);
    // How you are: your wounds and what to dress them with, what is on you, and how you are eating.
    const healthWin = this.windows.create({ id: 'health', title: 'Health', x: 364, y: 56, width: 540, height: 540, anchor: 'tr', open: false });
    this.health = new HealthPanel(healthWin, game, this.hud.effects.spells);
    // What you have on, on you, and what it makes of you in a fight.
    const equipWin = this.windows.create({ id: 'equipment', title: 'Equipment', x: 364, y: 56, width: 640, height: 660, anchor: 'tr', open: false });
    this.equipment = new EquipmentPanel(equipWin, game);
    // The handful you are moving today, beside the book that holds all forty.
    const craft = this.windows.create({ id: 'craft', title: 'Crafting', x: 364, y: 56, width: 360, height: 360, anchor: 'tr', open: false });
    this.craftPanel = new CraftPanel(craft, game);
    // What a thing takes down to what is gathered, put there by Crafting's List (`shopping.ts`).
    const shopWin = this.windows.create({ id: 'shopping', title: 'Shopping list', x: 364, y: 430, width: 340, height: 360, anchor: 'tr', open: false });
    this.shopping = new ShoppingPanel(shopWin, game);
    this.craftPanel.onList = (recipe, count) => this.shopping.add(recipe, count);
    const tileWin = this.windows.create({ id: 'tile', title: 'Tile', x: 12, y: 200, width: 300, height: 320, open: false });
    this.tilePanel = new TilePanel(tileWin, game, (pick) => this.menuFor(pick, (ground) => this.selectTile(ground)), this.tooltip);
    const map = this.windows.create({ id: 'map', title: 'Map', x: 12, y: 370, width: 236, height: 358, anchor: 'tr', open: false, seeThrough: true });
    this.minimap = new MinimapPanel(map, game, renderer);
    const settings = this.windows.create({ id: 'settings', title: 'Settings', x: 12, y: 56, width: 380, height: 520, anchor: 'tr', open: false });
    // How you look: back to the character creator on the account page, for
    // somebody on an island, who has an account to keep a look with.
    this.settings = new SettingsPanel(settings, game, cb.keys, this.island ? () => location.assign(creatorPage()) : null, this.windows);
    const crate = this.windows.create({ id: 'crate', title: 'Settlement crate', x: 364, y: 56, width: 320, height: 348, anchor: 'tr', open: false });
    this.cratePanel = new CratePanel(crate, game, (p) => this.moveDragged(p, 'store'),
      (x, y, title, items) => this.menu.show(x, y, title, items), (item, x, y) => this.compareCard(item, x, y));
    // Somebody else's shop counter: what is on it is bought, on an island.
    if (this.island) this.cratePanel.buyer = (it) => void this.buyOffCounter(it);
    // Marking a store as one of its settlement's (`stores.ts`), on an island.
    if (this.island) this.cratePanel.mark = (kind, id, on) => this.island?.markStore(kind, id, on) ?? Promise.resolve({ why: 'Island only.' });
    const journal = this.windows.create({ id: 'journal', title: 'Journal', x: 12, y: 56, width: 440, height: 460, anchor: 'tr', open: false });
    this.journalPanel = new JournalPanel(journal, game);
    // The trades you are watching: the journal's Tracker tab, redrawn as skills move only while it shows.
    this.tracker = new TrackerPanel(this.journalPanel.trackerPage, game, (x, y, title, items) => this.menu.show(x, y, title, items), () => journal.isOpen && this.journalPanel.tab === 'tracker');
    this.ledgerPanel = this.journalPanel.ledger;
    // "The rest of it" on the first-steps card opens the whole list.
    this.hud.openJournal = () => journal.open();
    const pals = this.windows.create({ id: 'wildermon', title: 'Wildermon', x: 364, y: 330, width: 330, height: 416, anchor: 'tr', open: false });
    this.wildermon = new WildermonPanel(
      pals,
      game,
      (id) => this.creatureEntries(id),
      (x, y, title, items) => this.menu.show(x, y, title, items),
    );
    /*
     * Every kind of creature, and which of them you have seen, tamed and bred:
     * the journal's Field guide tab, asked of the island only while it shows.
     * Opened from a creature's own menu too, at that kind's page.
     */
    this.guide = new GuidePanel(this.journalPanel.guidePage, game, this.island, () => journal.isOpen && this.journalPanel.tab === 'guide', () => this.journalPanel.open('guide'));
    const stores = this.windows.create({ id: 'stores', title: 'Stores', x: 12, y: 486, width: 360, height: 300, anchor: 'tr', open: false });
    this.stores = new StoresPanel(
      stores,
      game,
      (id) => this.cratePanel.open(id),
      (id) => this.cratePanel.openFurniture(id),
    );
    const deedWin = this.windows.create({ id: 'deed', title: 'Settlement', x: 12, y: 56, width: 360, height: 480, anchor: 'tr', open: false });
    this.deedPanel = new DeedPanel(deedWin, game, (x, y) => {
      game.moveTo(x, y);
      game.logMsg(`Walking to (${x}, ${y}).`, 'info');
    }, this.island ? (d) => void this.leaveSettlement(d) : undefined, this.island ? {
      // The Social window's answer, so the two windows cannot disagree about who lives where.
      known: () => this.social.known(),
      prime: () => this.social.prime(),
      again: () => this.social.again(),
      me: () => this.island?.uid ?? '',
      rank: (founder, uid, rank) => this.island?.rank(founder, uid, rank) ?? Promise.resolve('Island only.'),
      add: (name) => this.island?.rankAdd(name) ?? Promise.resolve('Island only.'),
      rename: (id, name) => this.island?.rankRename(id, name) ?? Promise.resolve('Island only.'),
      move: (id, dir) => this.island?.rankMove(id, dir) ?? Promise.resolve('Island only.'),
      drop: (id) => this.island?.rankDrop(id) ?? Promise.resolve('Island only.'),
      allow: (id, power, on) => this.island?.rankAllow(id, power, on) ?? Promise.resolve('Island only.'),
      newcomers: (id) => this.island?.rankNewcomers(id) ?? Promise.resolve('Island only.'),
      // Its notices, the work it wants and its ledger (`noticeboard.ts`).
      board: (founder, seen) => this.island?.settlement(founder, seen) ?? Promise.resolve('Island only.'),
      post: (founder, text) => this.island?.noticePost(founder, text) ?? Promise.resolve('Island only.'),
      unpost: (founder, n) => this.island?.noticeDrop(founder, n) ?? Promise.resolve('Island only.'),
      setWork: (founder, def, count, minQl) => this.island?.workSet(founder, def, count, minQl) ?? Promise.resolve('Island only.'),
      dropWork: (founder, id) => this.island?.workDrop(founder, id) ?? Promise.resolve('Island only.'),
      deliver: (founder, id) => this.island?.workDeliver(founder, id) ?? Promise.resolve('Island only.'),
      storeLog: (founder) => this.island?.storeLog(founder) ?? Promise.resolve({ why: 'Island only.' }),
      // Its orders, its workers by stance, its guards and who came onto it (`visitors.ts`).
      watch: (founder) => this.island?.deedWatch(founder) ?? Promise.resolve('Island only.'),
      orders: (founder, stance) => this.island?.deedOrders(founder, stance) ?? Promise.resolve('Island only.'),
      care: () => {
        this.wildermon.show('care');
        pals.open();
      },
    } : undefined);
    // Everybody, and what they are to you: who is waiting on an answer, who
    // you know and where they are, and what has been written.
    const socialWin = this.windows.create({ id: 'social', title: 'Social', x: 12, y: 56, width: 340, height: 420, anchor: 'tr', open: false });
    this.social = new SocialPanel(socialWin, game, this.island);
    /*
     * Where goods change hands. Beside the social window because it is the
     * same subject — other people — and reads its roll of who you know rather
     * than keeping a second one.
     */
    const marketWin = this.windows.create({ id: 'market', title: 'Market', x: 12, y: 56, width: 360, height: 440, anchor: 'tr', open: false });
    this.market = new MarketPanel(marketWin, game, this.island, () => this.social.folk());
    // The market on the map: every stall and counter on the last board read, and your own.
    this.minimap.stalls = () => this.market.stallsSeen();
    /*
     * Who leads the island: each skill's highest, the best-bred wildermon and
     * the biggest settlements. Beside the other two windows about other people,
     * and asked of the island only while it is open.
     */
    this.boards = new BoardsPanel(this.journalPanel.boardsPage, game, this.island, () => journal.isOpen && this.journalPanel.tab === 'boards');
    /*
     * Not on the Menu, because it is not a window you open — it is a window a
     * particular map opens. Reading a second map while the first is up shows
     * the second: there is only ever one picture in front of you.
     */
    const hoardWin = this.windows.create({ id: 'hoard', title: 'The map', x: 12, y: 56, width: 412, height: 520, anchor: 'tl', open: false });
    this.hoard = new HoardPanel(hoardWin, game, this.island);
    /*
     * A trade with one other person: opened by asking or being asked, not off
     * the Menu, and shut again by its close button when it is over.
     */
    const barterWin = this.windows.create({ id: 'barter', title: 'Barter', x: 12, y: 56, width: 440, height: 420, anchor: 'tl', open: false });
    this.barter = new BarterPanel(barterWin, game, this.island);
    if (this.island) this.social.trade = (uid) => void this.barter.ask(uid);
    /*
     * Wider than most, because a tree is three columns of three and a node has
     * a sentence on it: at this width the grid opens in three, and narrowing
     * the window stacks them rather than squeezing them. 560 is what three
     * readable cards and their gaps come to.
     */
    const tradesWin = this.windows.create({ id: 'trades', title: 'Trades', x: 12, y: 56, width: 560, height: 560, anchor: 'tl', open: false });
    this.trades = new TradesPanel(tradesWin, game, this.island, () => void this.faithBook.ask());
    /*
     * Faith: your patron and its tiers of spells, beside the Trades window it
     * is built like; and the spell bar along the bottom, which draws the same
     * answer. Asked once now, so the bar has what is in it from the start.
     */
    this.faithBook = new FaithBook(this.island);
    const faithWin = this.windows.create({ id: 'faith', title: 'Faith', x: 12, y: 56, width: 460, height: 560, anchor: 'tl', open: false });
    this.faith = new FaithPanel(faithWin, this.faithBook, game);
    this.spellBar = new SpellBar(root, game, this.faithBook, (x, y, title, items) => this.menu.show(x, y, title, items),
      () => this.windows.get('faith')?.open(), () => this.windows.get('trades')?.open());
    void this.faithBook.ask();
    /*
     * The handbook, fetched the first time the journal's Help tab is shown and
     * not before.
     *
     * It is a hundred and thirty kilobytes of prose — the single largest thing
     * in the bundle after the drawings, and every one of them was being
     * parsed and built into the page before the first frame, for a page that
     * most sessions never open at all. It is its own file: the island starts
     * sooner, and the handbook costs a moment the first time somebody asks for
     * it, by which point they are reading.
     */
    this.journalPanel.onShow = (tab) => {
      if (tab === 'help') void this.helpPages();
      if (tab === 'boards') this.boards.shown();
      if (tab === 'guide') this.guide.shown();
      if (tab === 'tracker') this.tracker.draw();
    };
    // A material no recipe makes: the help, opened at what it says about it.
    this.craftPanel.onNoRecipe = (item) => void this.helpAbout(item);
    this.palette = new Palette(root, () => this.findables());
    this.notices = new Notices(root, game);
    this.autoEat = new AutoEat(game);
    this.pointerRing = new PointerRing(root, game, canvas);
    this.deedBanner = new DeedBanner(root, game);

    /*
     * While you were away: what the island counted for you, shown once as you
     * come back, and written into the event log so it is still there once the
     * window is shut. Made only when there is something to say.
     */
    const away = this.island?.away ? awayLines(this.island.away) : [];
    if (away.length) {
      const awayWin = this.windows.create({ id: 'away', title: 'While you were away', x: 0, y: 0, width: 380, height: 240, open: true, fresh: true });
      awayWin.el.style.left = `${Math.max(0, (uiBox().w - 380) / 2)}px`;
      awayWin.el.style.top = `${Math.max(0, uiBox().h / 4)}px`;
      for (const line of away) {
        const p = document.createElement('p');
        p.className = 'away-line';
        p.textContent = line;
        awayWin.body.append(p);
        game.write(line, 'system');
      }
      awayWin.open();
    }

    /*
     * The notices of your settlements you have not been shown, once, as you
     * come ashore: in a small window and in the event log, like the tally
     * above. The island counts them seen as it answers.
     */
    if (this.island) void this.island.noticesAshore().then((list) => {
      if (!list.length) return;
      const win = this.windows.create({ id: 'notices-ashore', title: 'Notices', x: 0, y: 0, width: 380, height: 260, open: true, fresh: true });
      win.el.style.left = `${Math.max(0, (uiBox().w - 380) / 2)}px`;
      win.el.style.top = `${Math.max(0, uiBox().h / 3)}px`;
      for (const n of list) {
        const head = document.createElement('p');
        head.className = 'away-line deed-notice-by';
        head.textContent = `${n.deed} · ${n.by} · ${new Date(n.at * 1000).toLocaleString()}`;
        const text = document.createElement('p');
        text.className = 'away-line';
        text.textContent = n.text;
        win.body.append(head, text);
        game.write(`${settleLine('heard', { deed: n.deed, who: n.by })} ${n.text}`, 'system');
      }
      win.open();
    });

    // What's new, the journal's fourth tab, opened at by itself when something has changed since this browser last showed it.
    if (unseenNews()) this.journalPanel.open('news');

    // Whether this body keeps the island, asked once now that it is ashore.
    const isle = this.island;
    if (isle) void isle.amKeeper().then((yes) => {
      this.game.keeper = yes;
      if (yes) this.makeKeeper(isle);
    });
  }

  /** The Island keeper window, its row on the Menu and its key: for a keeper of the island, and nobody else. */
  private makeKeeper(island: Island): void {
    if (this.keeper) return;
    const win = this.windows.create({ id: 'keeper', title: 'Island keeper', x: 12, y: 56, width: 400, height: 440, anchor: 'tr', open: false });
    this.keeper = new KeeperPanel(win, this.game, island, (x, y, title, items) => this.menu.show(x, y, title, items));
    this.settings.showKeeper();
  }

  /**
   * A press, offered to the Keys tab before the game sees it.
   *
   * True means it was taken: something in Settings was waiting for a key, and
   * this one was it. Nothing else in the UI swallows keys, which is why this is
   * a question with one asker and one answerer rather than a chain.
   */
  grabKey(code: string): boolean {
    return this.settings.grab(code);
  }

  toggleWindow(id: string): void {
    this.windows.toggle(id);
  }

  /** Open the journal at a tab, or put it away if it is already open there. */
  toggleJournal(tab: JournalTab): void {
    this.journalPanel.toggle(tab);
  }

  /** The help's pages, building them into the journal's Help tab the first time (it is a file of its own, fetched then). */
  private helpPages(): Promise<HelpPages> {
    if (!this.helpBuilt) {
      this.helpBuilt = import('./panels/help').then((m) => {
        const pages = m.buildHelp(this.journalPanel.helpPage);
        this.helpTitles = pages.titles;
        return pages;
      });
    }
    return this.helpBuilt;
  }

  /**
   * The help, opened at what it says about something nothing makes at a bench.
   * The first section that names it, by its heading or else its text; the
   * whole help with a line to say so when none does.
   */
  private async helpAbout(item: string): Promise<void> {
    const name = itemDef(item).name;
    const pages = await this.helpPages();
    this.journalPanel.open('help');
    const hit = pages.search(name);
    this.game.logMsg(hit
      ? `No recipe makes ${name.toLowerCase()}. Help opened at its entry.`
      : `No recipe makes ${name.toLowerCase()}; no help entry by that name.`, 'info');
  }

  /** A weapon or armour under the pointer in the pack or a store, set against what you have on; anything else, what it is and is for (`itemCard`). */
  private compareCard(item: Item | null, x: number, y: number): void {
    // And for anything, what its like has sold for on the island this month (`priceLine`).
    const sold = item ? priceLine(this.market.prices[item.id]) : null;
    const lines = item ? compareLines(this.game, item) ?? itemCard(this.game, item) : null;
    if (lines && sold) lines.push(sold);
    if (lines) this.tooltip.show(x, y, lines, this.compareHolder, false, true);
    else this.tooltip.hide(this.compareHolder);
  }

  /** Who holds the tooltip while a comparison card is up, so the world's hover does not wipe it. */
  private readonly compareHolder = {};

  /** Open Find anything. */
  openPalette(): void {
    if (this.palette.isOpen) return;
    this.palette.open();
    // The help's pages come with the help, which is fetched the first time: added when they arrive.
    if (!this.helpBuilt) void this.helpPages().then(() => this.palette.refresh());
  }

  /** Put the windows where a layout keeps them, or keep them as they are in it (`keep`, Shift and the layout's key). */
  layout(slot: number, keep: boolean): void {
    const name = this.windows.layoutName(slot);
    if (keep) {
      this.windows.saveLayout(slot);
      this.game.logMsg(`Layout ${slot + 1} saved: “${name}”.`, 'info');
    } else if (!this.windows.useLayout(slot)) {
      const k = this.keys.label(`layout_${slot + 1}`);
      this.game.logMsg(`Layout ${slot + 1} “${name}” is empty. Save with ${k === 'unbound' ? 'Keep in Settings, Windows' : `Shift+${k}`}.`, 'info');
    }
    this.settings.drawLayouts();
    this.settings.refresh();
  }

  /** Everything Find anything can find. */
  private findables(): PaletteEntry[] {
    const out: PaletteEntry[] = [];
    const key = (id: string): string | undefined => {
      const l = this.keys.label(id);
      return l === 'unbound' ? undefined : l;
    };
    for (const b of BINDS) {
      const journalTab = ({ win_ledger: 'ledger', win_help: 'help', win_news: 'news', win_boards: 'boards', win_guide: 'guide', win_tracker: 'tracker' } as const)[b.id as 'win_ledger'];
      if (journalTab) {
        // The ledger, the help, what's new, the leaderboards, the field guide and the tracker are tabs of the journal, not windows of their own.
        const tab = journalTab;
        out.push({ label: b.label, kind: 'Window', hint: b.hint, key: key(b.id), run: () => this.journalPanel.open(tab) });
      } else if (b.id.startsWith('win_')) {
        const w = this.windows.get(b.id === 'win_events' ? 'events' : b.id.slice(4));
        if (!w) continue;
        out.push({ label: b.label, kind: 'Window', hint: b.hint, key: key(b.id), run: () => w.open() });
      } else if (b.id.startsWith('layout_') || b.id === 'palette' || b.id.startsWith('pan_')) {
        continue;
      } else if (this.presses[b.id]) {
        const press = this.presses[b.id];
        out.push({ label: b.label, kind: 'Do', hint: b.hint, key: key(b.id), run: press });
      }
    }
    for (let slot = 0; slot < LAYOUT_SLOTS; slot++) {
      const name = this.windows.layoutName(slot);
      const k = key(`layout_${slot + 1}`);
      if (this.windows.layoutKept(slot)) out.push({ label: `Use layout: ${name}`, kind: 'Layout', hint: `Restore layout ${slot + 1}`, key: k, run: () => this.layout(slot, false) });
      out.push({ label: `Keep layout: ${name}`, kind: 'Layout', hint: `Save current windows as layout ${slot + 1}`, key: k ? `Shift+${k}` : undefined, run: () => this.layout(slot, true) });
    }
    for (const r of RECIPES) {
      const made = itemDef(r.result).name;
      out.push({ label: made, kind: 'Recipe', hint: `${r.label} · ${r.category}`, run: () => this.craftPanel.showRecipe(r.id) });
    }
    const settingsWin = this.windows.get('settings');
    for (const f of this.settings.findables()) {
      out.push({ label: f.label, kind: 'Setting', hint: f.hint, run: () => {
        settingsWin?.open();
        f.reveal();
      } });
    }
    // Once the help has arrived: `openPalette` asks again when it does.
    for (const title of this.helpTitles) {
      out.push({ label: title, kind: 'Help', run: () => void this.helpPages().then((p) => {
        this.journalPanel.open('help');
        p.jump(title);
      }) });
    }
    return out;
  }

  /** Open the storage window on a crate or a piece of furniture. */
  openCrate(id: number): void {
    this.cratePanel.open(id);
  }

  openFurniture(id: number): void {
    this.cratePanel.openFurniture(id);
  }

  /**
   * What standing in the world a dragged thing could be let go into, under the
   * cursor: a crate, or a piece of furniture that holds things -- a chest, a
   * larder, a cart, a wagon. Not a trash crate, which destroys what goes in,
   * and not a market stall, whose wares want a price; both keep to the menu.
   *
   * And a crate rack, which holds nothing itself and so was never a place to
   * let anything go: what is dropped on one goes into the crates standing on
   * it, filling them one after another (`rack_put`).
   */
  storeAt(pick: Pick | null): { kind: 'crate' | 'furniture' | 'rack'; id: number } | null {
    if (!pick) return null;
    if (pick.crate !== undefined && this.game.crates.has(pick.crate)) return { kind: 'crate', id: pick.crate };
    if (pick.furniture === undefined) return null;
    const f = this.game.furniture.get(pick.furniture);
    if (f && rackSpots(f)) return { kind: 'rack', id: f.id };
    if (!f || !furnitureHolds(f)) return null;
    const def = furnitureDef(f.kind);
    return def.trash || def.stall ? null : { kind: 'furniture', id: f.id };
  }

  /**
   * A thing dragged out of the pack and let go over something in the world
   * that holds things goes into it: the whole stack, by the same door the
   * store window's drop and the "Put in" entries use, so the same rules hold.
   * Across the yard the feet go first. False when there was nothing there to
   * take it.
   */
  dropOnWorld(p: DragPayload, pick: Pick | null): boolean {
    const g = this.game;
    if (dropOnCounter(g, p, pick)) return true;
    const at = this.storeAt(pick);
    if (!at || p.from !== 'inventory') return false;
    const held = g.inventory.get(p.uid);
    if (!held) return true;
    if (g.isEquipped(held.uid)) {
      g.logMsg(`Remove the ${p.name.toLowerCase()} first.`, 'error');
      return true;
    }
    const def = ACTION_BY_ID.get(at.kind === 'crate' ? 'store_in_crate' : at.kind === 'rack' ? 'rack_put' : 'store_in_furniture');
    if (!def) return true;
    const target: Target = { kind: 'item', uid: held.uid, count: held.count, into: at.id };
    if (!def.applies(target, g)) {
      const where = at.kind === 'crate' ? crateName(g.crates.get(at.id)!) : furnitureName(g.furniture.get(at.id)!);
      g.logMsg(`The ${p.name.toLowerCase()} will not go in the ${where.toLowerCase()}.`, 'error');
      return true;
    }
    g.requestAction(def, target);
    return true;
  }

  /**
   * Carry a dragged thing from one window to the other. The same rules apply as
   * to the menu entries that do the same job: you have to be able to reach the
   * container, and it has to be willing to hold what you are giving it.
   */
  private moveDragged(p: DragPayload, to: 'inventory' | 'store'): void {
    /*
     * Shift held as the drag began: how many of the stack, asked first. Asked
     * for as "split a stack": fifteen of a hundred and twenty copper lumps
     * into the crate was a drag of the lot and fifteen trips back one at a
     * time, or a pile dropped on the ground and picked over.
     */
    // Several picked and dragged together: each goes, whole.
    if (p.uids && p.uids.length > 1) {
      const store = this.cratePanel.currentStore();
      for (const uid of p.uids) {
        const it = to === 'inventory' ? store?.items.find((i) => i.uid === uid) : this.game.inventory.get(uid);
        if (it) this.moveDraggedN({ uid, from: p.from, name: itemName(it) }, to);
      }
      return;
    }
    const store = this.cratePanel.currentStore();
    const held = to === 'inventory' ? store?.items.find((it) => it.uid === p.uid) : this.game.inventory.get(p.uid);
    const ask = this.game.hooks.count;
    if (p.split && held && held.count > 1 && ask) {
      void ask(`${p.name}: count to move (of ${held.count})?`, held.count, Math.ceil(held.count / 2)).then((n) => {
        if (n) this.moveDraggedN(p, to, n);
      });
      return;
    }
    this.moveDraggedN(p, to);
  }

  /** Move a dragged stack, or `n` of it. */
  private moveDraggedN(p: DragPayload, to: 'inventory' | 'store', n?: number): void {
    const g = this.game;
    const store = this.cratePanel.currentStore();
    if (!store) return;
    if (!this.cratePanel.withinReach()) {
      g.logMsg(`Too far from the ${store.what}.`, 'error');
      return;
    }
    /*
     * On an island a drag is an ask like any other.
     *
     * Reported as rubber-banding: "it's happening when I click and drag but
     * not when I click and hit button". This half moved the row from one
     * window to the other in the browser's own copy and told nobody, so the
     * next answer from the island put it straight back. The menu entries have
     * always gone through `requestAction`; this now does too, and a drag ends
     * up meaning exactly what the entry beside it means.
     *
     * A bag on your back is the island's too, since the bag work: it holds
     * rows like any other store and `take_from_store` and `stow_item` are its
     * doors. Panniers have none of their own and are still carried here, which
     * is right: they are a beast's and travel with it.
     */
    // A line out of everything on a rack: from its crates in the rack's order until the count is met (`rackTakes`).
    if (to === 'inventory' && store.takeN) {
      const held = store.items.find((it) => it.uid === p.uid);
      if (held) store.takeN(p.uid, Math.min(n ?? Infinity, held.count));
      return;
    }
    if ((g.ask || store.doors) && store.kind !== 'carried') {
      const id = store.doors ? (to === 'inventory' ? store.doors.out : store.doors.in)
        : to === 'inventory' ? 'take_from_store'
        : store.kind === 'crate' ? 'store_in_crate'
        : store.kind === 'rack' ? 'rack_put'
        : store.kind === 'bag' ? 'stow_item' : 'store_in_furniture';
      const def = ACTION_BY_ID.get(id);
      if (!def) return;
      const held = to === 'inventory'
        ? store.items.find((it) => it.uid === p.uid)
        : g.inventory.get(p.uid);
      // Which store it was dragged into, so that it goes into that one rather
      // than into whichever happens to stand nearest.
      g.requestAction(def, { kind: 'item', uid: p.uid, count: Math.min(n ?? Infinity, held?.count ?? 1), into: store.id });
      return;
    }
    if (to === 'inventory') {
      const item = store.take(p.uid);
      if (!item) return;
      g.inventory.addItem(item);
      g.logMsg(`Taken from the ${store.what}: ${p.name.toLowerCase()}.`, 'event');
      return;
    }
    const held = g.inventory.get(p.uid);
    if (!held) return;
    if (g.isEquipped(held.uid)) {
      g.logMsg(`Remove the ${p.name.toLowerCase()} first.`, 'error');
      return;
    }
    const occupied = occupiedRefusal(g, 'store_in_furniture', { kind: 'item', uid: held.uid });
    if (occupied) {
      g.logMsg(occupied, 'error');
      return;
    }
    const refused = store.refuses(held);
    if (refused) {
      g.logMsg(refused, 'error');
      return;
    }
    // What there is room for rather than the whole armful: the rest stays in
    // the pack and is said so, instead of the drag being refused outright.
    const fits = Math.min(store.fits(held), n ?? Infinity);
    const item = fits > 0 ? g.inventory.take(held.uid, fits) : null;
    if (!item) {
      g.logMsg(`The ${store.what} is full.`, 'error');
      return;
    }
    if (!store.add(item)) {
      g.inventory.addItem(item);
      g.logMsg(`The ${store.what} will not take the ${p.name.toLowerCase()}.`, 'error');
      return;
    }
    g.logMsg(storedLine(item.count, p.name, store.what, held.count - item.count), 'event');
  }

  /**
   * Point the tile window at what was clicked. Opening it on a click is what
   * makes the game playable with one button; the setting turns that off for
   * anyone who would rather keep to the right-click menu.
   */
  selectTile(pick: Pick | null): void {
    this.tilePanel.select(pick, this.game.settings.tileWindow);
    this.renderer.selected = pick ? { x: pick.x, y: pick.y, down: pick.down, level: pick.level } : null;
  }

  focusChat(): void {
    this.windows.get('events')?.open();
    this.eventLog.focus();
  }

  update(fps: number): void {
    // Runecut's light on the island clock turns at dusk and dawn; set to Day or Night this writes nothing.
    applyLook(this.game.settings, this.game.isNight());
    this.notices.update(performance.now());
    this.autoEat.update(performance.now() / 1000);
    this.pointerRing.update(performance.now());
    this.deedBanner.update(performance.now());
    this.hud.update(this.renderer, fps);
    this.renderer.selected = this.tilePanel.target ? { x: this.tilePanel.target.x, y: this.tilePanel.target.y, down: this.tilePanel.target.down, level: this.tilePanel.target.level } : null;
    this.minimap.update();
    this.settings.refresh();
    this.wildermon.update(performance.now());
    this.stores.update(performance.now());
    this.deedPanel.update(performance.now());
    this.social.update(performance.now() / 1000);
    this.market.update(1 / 60);
    this.boards.update(performance.now() / 1000);
    this.keeper?.update(performance.now() / 1000);
    this.hoard.update(performance.now() / 1000);
    this.barter.update(performance.now() / 1000);
    this.tilePanel.update(performance.now());
    this.craftPanel.update(performance.now());
    this.ledgerPanel.update(performance.now());
    this.trades.update(performance.now() / 1000);
    this.faith.update(performance.now() / 1000);
    this.health.update(performance.now());
    this.equipment.update(performance.now());
    this.shopping.update(performance.now());
    this.spellBar.update();
  }

  /** Call the spell in a slot of the bar (Shift and its number). */
  castSpell(slot: number): void {
    void this.spellBar.cast(slot);
  }

  /** Describe what is under the cursor. */
  /**
   * One job in a menu. A job that runs on and on is offered by the handful as
   * well: five, ten, twenty-five, or until your wind gives out. That way a
   * hundred bricks is one right-click and not a hundred.
   */
  private jobEntry(def: ActionDef, target: Target, reason: string | null, label: string): MenuItem {
    return jobEntry(this.game, def, target, reason, label);
  }

  /**
   * The thing under the cursor as a target: whatever is standing on the tile
   * if anything is, and the tile itself otherwise. What the belt aims at.
   */
  private targetOf(pick: Pick): Target {
    if (pick.creature !== undefined) return { kind: 'creature', id: pick.creature };
    if (pick.crate !== undefined) return { kind: 'crate', id: pick.crate };
    if (pick.fire !== undefined) return { kind: 'campfire', id: pick.fire };
    if (pick.smelter !== undefined) return { kind: 'smelter', id: pick.smelter };
    if (pick.kiln !== undefined) return { kind: 'kiln', id: pick.kiln };
    if (pick.anvil !== undefined) return { kind: 'anvil', id: pick.anvil };
    if (pick.post !== undefined) return { kind: 'post', id: pick.post };
    if (pick.trap !== undefined) return { kind: 'trap', id: pick.trap };
    if (pick.bridge !== undefined) return { kind: 'bridge', id: pick.bridge };
    if (pick.furniture !== undefined) return { kind: 'furniture', id: pick.furniture };
    return { kind: 'tile', x: pick.x, y: pick.y, cx: pick.cx, cy: pick.cy };
  }

  /**
   * Press a number key. What it does depends on what is in front of you: the
   * Tile window takes the numbers whenever it is open and looking at
   * something, since the thing selected is what you mean; otherwise they press
   * the loops on your belt.
   */
  pressNumber(index: number): void {
    if (this.tilePanel.press(index)) return;
    this.useLoop(index);
  }

  /** Whether the selection window is holding the number keys just now. */
  get numbersTaken(): boolean {
    return this.bindings.length > 0;
  }

  /**
   * What each number key would do right now, for the help and for tests. The
   * HUD is built before the windows are and draws its belt straight away, so
   * this has to answer before there is a selection window to ask.
   */
  get bindings(): Array<{ key: string; label: string }> {
    return this.tilePanel?.bindings ?? [];
  }

  /** Press a loop on the belt, aimed at whatever the cursor is on. */
  useLoop(loop: number): void {
    const pick = this.renderer.hover;
    this.game.useLoop(loop, pick ? this.targetOf(pick) : null);
  }

  /** Pick up a piece to set down: it follows the cursor from here, and Q and E turn it. */
  startPlacing(item: Item): void {
    this.placing = { kind: 'furniture', itemUid: item.uid, piece: item.id, material: item.extra, facing: 's' };
    // A trellis turns itself to the wall it goes against (`placingFacing`).
    this.game.logMsg(furnitureDef(item.id).vine
      ? `Placing ${itemName(item).toLowerCase()}: snaps to the nearest wall side. Click: place. Esc: cancel.`
      : `Placing ${itemName(item).toLowerCase()}: Q/E rotate. Click: place. Esc: cancel.`, 'info');
  }

  /**
   * Which way a piece being placed faces: the way Q and E have turned it, or
   * for a trellis the side of the tile under the cursor it would stand
   * against nearest the cursor, and with none the nearest side, to be shown
   * refused there (`trellisFacing`).
   */
  private placingFacing(p: Extract<Placing, { kind: 'furniture' }>, pick: Pick): Side {
    if (!furnitureDef(p.piece).vine) return p.facing;
    return trellisFacing(this.game, pick.x, pick.y, pick.wx - pick.x, pick.wy - pick.y, this.game.player.level);
  }

  /** Undo on your last plan, while the island still keeps it (`PLAN_UNDO_SECONDS`). */
  private undoRows(): MenuItem[] {
    return this.canUndoPlan() ? [{ label: 'Undo last plan', note: 'Ctrl+Z', onSelect: () => void this.undoPlan() }] : [];
  }

  /**
   * Walls on every bare outside side of a building's storey, of one type in one material: laid out first, with its
   * totals (`startPlanArea`). Types a whole round of is built in: no doors, gates or counters.
   */
  private areaWallRows(b: Building, level: number, x: number, y: number): MenuItem[] {
    const bld = this.game.buildings;
    const inside = new Set(b.tiles);
    let bare = 0;
    for (const k of b.tiles) {
      const [tx, ty] = k.split(',').map(Number);
      for (const [side, dx, dy] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]] as Array<[Side, number, number]>) {
        if (!inside.has(`${tx + dx},${ty + dy}`) && !bld.wall(level, tx, ty, side) && !bld.noPlan(level, borderOf(tx, ty, side))) bare++;
      }
    }
    if (bare < 2) return [];
    const types = WALL_TYPES.filter((wt) => !wt.passable && wt.id !== 'counter' && (wt.id !== 'railing' || level > 0 || b.deck != null));
    return [{
      label: `Plan walls all round (storey ${level + 1})`,
      note: `${bare} sides`,
      children: types.map((wt) => ({
        label: wt.name,
        children: MATERIALS.filter((m) => fitsMaterial(wt.id, m) && takesAs(m, { wall: wt.id })).map((m) => ({
          label: m.name,
          note: `${describeNeeds(wallBill(m.id, wt.id), materialName)} each`,
          onSelect: () => this.startPlanArea({ kind: 'walls', buildingId: b.id, level, wallType: wt.id as WallType, material: m.id, anchor: { x, y } }),
        })),
      })),
    }];
  }

  /** A floor on every tile of a building's storey with none, in one material: laid out first, with its totals. */
  private areaFloorRows(b: Building, level: number, x: number, y: number): MenuItem[] {
    const bld = this.game.buildings;
    const bare = b.tiles.filter((k) => {
      const [tx, ty] = k.split(',').map(Number);
      return !bld.floor(level, tx, ty);
    }).length;
    if (bare < 2) return [];
    return [{
      label: `Plan ${level > 0 ? 'floor' : 'flooring'}: every tile (storey ${level + 1})`,
      note: `${bare} tiles`,
      children: MATERIALS.filter((m) => takesAs(m, { floor: 'floor' })).map((m) => ({
        label: m.name,
        note: `${describeNeeds(floorBill(m.id), materialName)} each`,
        onSelect: () => this.startPlanArea({ kind: 'floor', buildingId: b.id, level, material: m.id, anchor: { x, y } }),
      })),
    }];
  }

  /**
   * Plan a staircase or a ladder on a tile, up to the storey over it or down
   * to the cellar under it (`down`): the side to climb from turns with Q and
   * E, and for a single staircase (`hand`) the half of the tile it runs up.
   */
  startPlacingStairs(base: Target, level: number, material: string, floorKind: 'stairs' | 'ladder', side: Side, down = false, hand?: StairHand): void {
    if (base.kind !== 'tile') return;
    const single = floorKind === 'stairs' ? hand : undefined;
    // Out past the footprint, an outside staircase: for the building the job names, on the storey it names (`outsideStairReason`).
    this.placing = { kind: 'stairs', x: base.x, y: base.y, cx: base.cx, cy: base.cy, level, material, floorKind, side, down, hand: single, buildingId: base.buildingId };
    this.game.logMsg(single === SPIRAL ? 'Click: plan. Esc: cancel.' : single ? `${SINGLE_TURNS}. Click: plan. Esc: cancel.` : 'Q/E: climbing side. Click: plan. Esc: cancel.', 'info');
  }

  /** A quarter turn of what is being placed: to the right for +1, to the left for -1. */
  rotatePlacing(step: number): void {
    const p = this.placing;
    if (!p || p.kind === 'area') return;
    if (p.kind === 'furniture') p.facing = turnedFacing(p.facing, step);
    // A spiral staircase has no side it is climbed from.
    else if (p.hand === SPIRAL) return;
    else if (p.hand) {
      // A single staircase goes round the tile a half at a time: across to the other half, then a quarter turn on.
      const [first, second]: [StairHand, StairHand] = step > 0 ? ['l', 'r'] : ['r', 'l'];
      if (p.hand === first) p.hand = second;
      else {
        p.hand = first;
        p.side = turnedFacing(p.side, step);
      }
    } else p.side = turnedFacing(p.side, step);
  }

  /** The job a staircase or a ladder being placed asks for: an outside staircase names its building and its storey. */
  private stairsTarget(p: Extract<Placing, { kind: 'stairs' }>): Target {
    // Up a storey it names its storey, as every storey job does (`jobLevel`); a way down to a cellar is the ground floor's.
    const out = p.buildingId !== undefined ? { buildingId: p.buildingId, level: p.level } : p.down ? {} : { level: p.level };
    return { kind: 'tile', x: p.x, y: p.y, cx: p.cx, cy: p.cy, side: p.side, material: p.material, floorKind: p.floorKind, down: p.down, hand: p.hand, ...out };
  }

  cancelPlacing(): void {
    const area = this.placing?.kind === 'area';
    this.placing = null;
    this.renderer.ghost = null;
    this.renderer.planGhost = null;
    this.areaLaid = [];
    if (area) this.planBar.hide();
  }

  /**
   * Lay out a plan over an area (`planarea.ts`): every piece of it drawn as a
   * ghost, red where it would be refused, with what the lot takes against the
   * pack and the stores within reach on the bar under it. A click, or Plan on
   * the bar, asks the island for the pieces that pass; Esc or Cancel drops it.
   * A footprint follows the cursor from its first corner.
   */
  startPlanArea(plan: AreaPlan): void {
    this.cancelPlacing();
    this.placing = { kind: 'area', plan };
    this.layArea(null);
    this.game.logMsg(plan.kind === 'footprint' ? 'Planning an area: cursor sets the far corner. Click: plan. Esc: cancel.' : 'Click: plan. Esc: cancel.', 'info');
  }

  /** The plan over an area worked out afresh, its ghost and its bar: a footprint to the tile under the cursor. */
  private layArea(pick: Pick | null): void {
    const p = this.placing;
    if (p?.kind !== 'area') return;
    const plan = p.plan;
    if (plan.kind === 'footprint' && pick && !pick.down && (pick.level ?? 0) <= 0) plan.corner = { x: pick.x, y: pick.y };
    const pieces = areaPieces(this.game, plan);
    this.areaLaid = pieces;
    const ghostKind = plan.kind === 'walls' ? 'wall' : plan.kind === 'footprint' ? 'tile' : plan.kind;
    this.renderer.planGhost = pieces.map((q) => ({
      kind: ghostKind, x: q.target.x, y: q.target.y, side: q.target.side,
      level: plan.kind === 'roof' ? plan.level + 1 : plan.level, ok: !q.why,
    }));
    const ok = passing(pieces).length;
    const b = plan.buildingId !== undefined ? this.game.buildings.list.get(plan.buildingId) : undefined;
    const what = plan.kind === 'walls' ? `${WALL_TYPE_BY_ID.get(plan.wallType ?? 'solid')?.name ?? 'Wall'}, ${MATERIAL_BY_ID.get(plan.material ?? '')?.name.toLowerCase() ?? ''}`
      : plan.kind === 'footprint' ? (b ? `Add to ${b.name}` : plan.name ?? 'New building')
        : `${plan.material === GLASS_ROOF.id ? GLASS_ROOF.name : MATERIAL_BY_ID.get(plan.material ?? '')?.name ?? ''}`;
    const where = plan.kind === 'roof' ? ' · roof' : plan.kind === 'footprint' ? '' : ` · storey ${plan.level + 1}`;
    this.planBar.show({
      title: `Plan: ${areaCount(plan, ok)} · ${what}${where}`,
      count: ok,
      totals: areaTotals(this.game, pieces),
      refused: areaRefusals(pieces),
    });
  }

  /** The plan over an area laid out asked of the island, the pieces that pass, in one call; then Undo on the bar. */
  async commitPlanArea(): Promise<void> {
    const p = this.placing;
    if (p?.kind !== 'area') return;
    const plan = p.plan;
    const pieces = this.areaLaid.length ? this.areaLaid : areaPieces(this.game, plan);
    const asks = areaAsk(pieces);
    if (!asks.length) {
      this.game.logMsg(areaRefusals(pieces)[0]?.why ?? 'Nothing to plan.', 'error');
      return;
    }
    this.cancelPlacing();
    if (!this.game.planArea) {
      this.game.logMsg('Not on the island.', 'error');
      return;
    }
    // Asked from beside a piece of it, as a single plan is: walked to the nearest first, and sent on arriving.
    const near = this.nearestAsk(asks);
    if (near.d > 1) {
      if (!this.game.moveTo(near.x, near.y)) return;
      this.areaPending = { plan, asks };
      return;
    }
    await this.sendArea(plan, asks);
  }

  /** The tile of the plan nearest where you stand, and how far it is, in whole tiles either way. */
  private nearestAsk(asks: ReturnType<typeof areaAsk>): { x: number; y: number; d: number } {
    const p = this.game.player;
    let best = { x: p.tileX, y: p.tileY, d: Infinity };
    for (const a of asks) {
      const d = Math.max(Math.abs(a.target.x - p.tileX), Math.abs(a.target.y - p.tileY));
      if (d < best.d) best = { x: a.target.x, y: a.target.y, d };
    }
    return best;
  }

  /** A plan over an area asked of the island, and Undo offered on it once it is planned. */
  private async sendArea(plan: AreaPlan, asks: ReturnType<typeof areaAsk>): Promise<void> {
    if (!this.game.planArea) return;
    const said = await this.game.planArea(asks);
    if (!said.planned) return;
    this.game.plannedAt = Date.now();
    this.planBar.offerUndo(`Planned: ${areaCount(plan, said.planned)}`, this.game.plannedAt + PLAN_UNDO_SECONDS * 1000);
  }

  /** A plan over an area waiting on the feet: sent once they stop beside a piece of it, dropped when they stop anywhere else. */
  private areaArrived(): void {
    const pending = this.areaPending;
    if (!pending || this.game.player.moving || this.game.player.path?.length) return;
    this.areaPending = null;
    if (this.nearestAsk(pending.asks).d <= 1) void this.sendArea(pending.plan, pending.asks);
  }

  /** Whether your last plan can still be taken back (`PLAN_UNDO_SECONDS`). */
  canUndoPlan(): boolean {
    // Not while a plan asked for by hand is still in hand or lined up: the last plan is the one before it until it is done.
    const pending = [this.game.action, ...this.game.queue].some((j) => !!j && UNDONE_PLANS.has(j.def.id));
    return !!this.game.undoPlan && !pending && this.game.plannedAt > 0 && Date.now() - this.game.plannedAt < PLAN_UNDO_SECONDS * 1000;
  }

  /** Your last plan taken back, every piece of it still standing (`rpc_plan_undo`). */
  async undoPlan(): Promise<void> {
    this.planBar.hide();
    if (!this.game.undoPlan) return;
    const said = await this.game.undoPlan();
    if (said.removed) this.game.plannedAt = 0;
  }

  /** The ghost the renderer draws for what is being placed, worked out from where the cursor is. */
  syncGhost(pick: Pick | null): void {
    if (this.areaPending) this.areaArrived();
    const p = this.placing;
    if (!p) {
      this.renderer.ghost = null;
      return;
    }
    // A footprint follows the cursor; any other plan over an area stays as it was laid out.
    if (p.kind === 'area') {
      if (p.plan.kind === 'footprint' && pick && (p.plan.corner?.x !== pick.x || p.plan.corner?.y !== pick.y)) this.layArea(pick);
      return;
    }
    if (p.kind === 'stairs') {
      const plan = ACTION_BY_ID.get('plan_floor');
      const target = this.stairsTarget(p);
      this.renderer.ghost = { kind: 'stairs', x: p.x, y: p.y, level: p.level, material: p.material, floorKind: p.floorKind, side: p.side, hand: p.hand, ok: !(plan?.check?.(target, this.game) ?? null), buildingId: p.buildingId };
      return;
    }
    if (!pick) {
      this.renderer.ghost = null;
      return;
    }
    const [s0, t0] = subtileOf(pick.x, pick.y, pick.wx, pick.wy);
    const facing = this.placingFacing(p, pick);
    const [ax, ay] = furnitureAnchor(p.piece, s0, t0, facing);
    // On a pinned storey, on its floor (`storeyview.ts`).
    this.renderer.ghost = { kind: 'furniture', piece: p.piece, material: p.material, x: pick.x, y: pick.y, sx: ax, sy: ay, facing, level: pick.level,
      ok: !this.game.furniturePlaceReason(p.piece, pick.x, pick.y, ax, ay, facing, undefined, pick.level) };
  }

  /** A click while something is being placed: the left button sets it down where the cursor is, any other keeps it. */
  placeClick(pick: Pick | null, button: number): void {
    const p = this.placing;
    if (!p) return;
    if (button !== 0) {
      this.cancelPlacing();
      return;
    }
    if (p.kind === 'area') {
      if (p.plan.kind === 'footprint' && pick) this.layArea(pick);
      void this.commitPlanArea();
      return;
    }
    if (p.kind === 'stairs') {
      const plan = ACTION_BY_ID.get('plan_floor');
      const target = this.stairsTarget(p);
      const reason = plan?.check?.(target, this.game) ?? null;
      if (reason) {
        this.game.logMsg(reason, 'error');
        return;
      }
      if (plan) this.game.requestAction(plan, target);
      this.cancelPlacing();
      return;
    }
    if (!pick) return;
    const def = ACTION_BY_ID.get('place_furniture');
    const [s0, t0] = subtileOf(pick.x, pick.y, pick.wx, pick.wy);
    const facing = this.placingFacing(p, pick);
    const [ax, ay] = furnitureAnchor(p.piece, s0, t0, facing);
    const target: Target = { kind: 'tile', x: pick.x, y: pick.y, cx: pick.cx, cy: pick.cy, sx: ax, sy: ay, itemUid: p.itemUid, facing, ...(pick.level !== undefined ? { level: pick.level } : {}) };
    const reason = def?.check?.(target, this.game) ?? null;
    if (reason) {
      this.game.logMsg(reason, 'error');
      return;
    }
    if (def) this.game.requestAction(def, target);
    this.cancelPlacing();
  }

  /**
   * The world under the pointer, every frame (`main.ts`): outlined, said in the
   * tooltip, and the ghost of what is being placed put on it. `drop` is a drag
   * out of the pack held over a store, asked of the drag because the browser's
   * drag holds the pointer's own events back.
   */
  hoverFrame(pointer: Pointer, dragging: boolean, drop: { pick: Pick; x: number; y: number } | null): void {
    // On the world, the pointer is on no row of a window (`Tooltip.pointerOnWorld`).
    if (drop || pointer.overCanvas) this.tooltip.pointerOnWorld();
    if (drop) {
      this.renderer.hover = drop.pick;
      this.setHover(drop.pick, drop.x, drop.y);
      this.syncGhost(null);
    } else if (pointer.overCanvas && !dragging && !this.menu.isOpen) {
      this.renderer.hover = this.renderer.hoverPick(pointer.x, pointer.y);
      this.setHover(this.renderer.hover, pointer.x, pointer.y);
      this.syncGhost(this.renderer.hover);
    } else {
      this.renderer.hover = null;
      this.renderer.forgetPick();
      this.setHover(null, 0, 0);
      this.syncGhost(null);
    }
  }

  setHover(pick: Pick | null, sx: number, sy: number): void {
    if (!pick) {
      this.tooltip.hide();
      return;
    }
    const w = this.game.world;
    const lines: string[] = [];
    const growing = this.game.cropAt(pick.x, pick.y);
    const creature = pick.creature !== undefined ? this.game.creatures.get(pick.creature) : undefined;
    if (creature) {
      this.tooltip.show(sx, sy, creatureLines(this.game, creature));
      return;
    }
    const sm = pick.smelter !== undefined ? this.game.smelters.get(pick.smelter) : undefined;
    if (sm) {
      lines.push('Stone smelter');
      lines.push(smelterState(sm));
      if (sm.jobs.length) lines.push(`Working: ${itemDef(sm.jobs[0].makes).name.toLowerCase()}, ${Math.ceil(sm.jobs[0].left)}s left`);
      this.tooltip.show(sx, sy, lines);
      return;
    }
    const fu = pick.furniture !== undefined ? this.game.furniture.get(pick.furniture) : undefined;
    if (fu && isGrave(fu)) {
      this.tooltip.show(sx, sy, [graveName(this.game, fu), graveLine(this.game, fu)]);
      return;
    }
    if (fu) {
      lines.push(furnitureName(fu));
      lines.push(furnitureState(fu));
      // A lantern post's lantern, what it throws and its candle, as its menu says them (`lamps.ts`).
      if (isLampPiece(fu)) lines.push(lampState(fu));
      if (rackSpots(fu)) lines.push(this.rackLine(fu));
      if (furnitureHolds(fu)) lines.push('Storage: use from adjacent.');
      if (isPlanter(fu)) lines.push(this.planterLine(fu));
      this.tooltip.show(sx, sy, lines);
      return;
    }
    const kl = pick.kiln !== undefined ? this.game.kilns.get(pick.kiln) : undefined;
    if (kl) {
      lines.push('Kiln');
      lines.push(kilnState(kl));
      if (kl.jobs.length) lines.push(`Firing: ${itemDef(kl.jobs[0].makes).name.toLowerCase()}, ${Math.ceil(kl.jobs[0].left)}s left`);
      this.tooltip.show(sx, sy, lines);
      return;
    }
    const an = pick.anvil !== undefined ? this.game.anvils.get(pick.anvil) : undefined;
    if (an) {
      lines.push(anvilName(an));
      lines.push(`QL ${an.ql.toFixed(1)} · bring a mould and metal`);
      this.tooltip.show(sx, sy, lines);
      return;
    }
    const fire = pick.fire !== undefined ? this.game.campfires.get(pick.fire) : undefined;
    if (fire) {
      lines.push('Campfire');
      lines.push(fireState(fire));
      if (fire.lit) lines.push('Lit: cook here.');
      this.tooltip.show(sx, sy, lines);
      return;
    }
    const crate = pick.crate !== undefined ? this.game.crates.get(pick.crate) : undefined;
    if (crate) {
      lines.push(crateName(crate));
      lines.push(`${crateUnits(crate)} / ${crateCapacity(crate)} things · spot ${crate.sx + 1},${crate.sy + 1} of tile ${crate.x}, ${crate.y}`);
      this.tooltip.show(sx, sy, lines);
      return;
    }
    // On a pinned storey's floor (`storeyview.ts`): the storey, and nothing of the ground under it.
    const aloft = (pick.level ?? 0) > 0;
    const t = w.getTile(pick.x, pick.y);
    if (aloft) {
      // A roof's own level is its roof's (`storeyview.ts`), on a building's own tiles.
      const own = this.game.buildings.buildingAt(pick.x, pick.y);
      lines.push(`${own && (pick.level ?? 0) >= own.levels ? 'Roof' : `Storey ${(pick.level ?? 0) + 1}`} · ${pick.x}, ${pick.y}`);
    } else if (t === TileType.Tree) {
      const data = w.getData(pick.x, pick.y);
      lines.push(`${treeAge(data).name} ${TREE_DEFS[treeSpecies(data)].name.toLowerCase()} tree`);
    } else if (growing) {
      // A ripe field says so on its first line, for picking it out of a row of them.
      lines.push(`${cropDef(growing.id).name} field${cropReady(growing) ? ' · ripe' : ''}`);
    } else {
      lines.push(w.tileName(pick.x, pick.y));
    }
    if (!aloft) {
      if (growing) lines.push(this.cropLine(growing));
      // What it gives now: fish, picked over or ready, in season (`yieldLines`).
      lines.push(...yieldLines(this.game, pick.x, pick.y));
      const planted = this.game.waterPlantAt(pick.x, pick.y);
      if (planted) lines.push(describeWaterPlant(this.game, planted, this.game.wallNow()));
      // A mote swirl over it, by its element (`motes.ts`).
      const swirl = this.game.swirlAt(pick.x, pick.y);
      if (swirl) lines.push(swirlName(swirl.element));
      // A Runestone standing on it, by name (`runestones.ts`).
      const stone = runestoneAt(pick.x, pick.y, w.w);
      if (stone) lines.push(`${stone.name}, a Runestone`);
      lines.push(`${pick.x}, ${pick.y} · slope ${metres(w.slope(pick.x, pick.y))} m`);
      lines.push(cornerReading(this.game, pick.cx, pick.cy));
      const reading = groundReading(this.game, pick.x, pick.y);
      if (reading) lines.push(reading);
    }
    /*
     * Whose ground this is, and what you are on it.
     *
     * Your own settlement has said its name here for a long time; somebody
     * else's said nothing at all, so a stranger's land was a green border and
     * a stake, and the only way to find out whose it was or whether you were
     * allowed to dig was to try and be refused. A settlement is the most
     * conspicuous thing a person builds and it is worth being able to read
     * one from outside.
     */
    const mine = this.game.deedOfMineAt(pick.x, pick.y);
    const here = mine ?? this.game.deedAt(pick.x, pick.y);
    if (here) {
      const token = this.game.isToken(pick.x, pick.y);
      const who = 'holder' in here && here.holder ? `, ${here.holder}\u2019s` : '';
      const level = here.level && here.level > 1 ? ` \u00b7 level ${here.level}` : '';
      lines.push(`${token ? 'Settlement totem of' : 'Part of'} ${here.name}${who}${level}`);
      lines.push(mine ? standingWord(mine) : 'Not a citizen: walk only, no building or terraforming.');
    }
    // A drawbridge says whether it is up (`gates.ts`).
    const span = pick.bridge !== undefined ? this.game.bridges.get(pick.bridge) : undefined;
    if (span && isDrawbridge(span)) lines.push(`${bridgeName(span)} · ${bridgeDone(span) ? drawbridgeState(span) : bridgeState(span)}`);
    // Pinned on a storey over the ground, a building's tile picked on the ground is of a storey hidden (`storeyview.ts`).
    const pinned = this.game.pinnedStorey();
    const hidden = pinned !== null && pinned > 0 && pick.level === 0;
    const b = hidden ? undefined : this.game.buildings.buildingAt(pick.x, pick.y);
    // The storey the lines are for: the one picked on when one is pinned, else the one being worked (`Game.storeyFor`).
    const level = b ? (pick.level !== undefined ? Math.min(pick.level, b.levels - 1) : this.game.storeyFor(b)) : 0;
    // And a portcullis, or a hidden door to whoever it admits, whatever storey is worked on and from either side (`gates.ts`).
    const gateSide = nearestSide(pick.x, pick.y, pick.wx, pick.wy);
    const gateLine = gateHoverLine(this.game, pick.x, pick.y, gateSide, SIDE_NAMES[gateSide], !!b && level > 0);
    if (gateLine && !b) lines.push(gateLine);
    if (b) {
      const storeys = b.levels === 1 ? '1 storey' : pinned !== null ? `${b.levels} storeys` : `${b.levels} storeys, working on storey ${level + 1}`;
      const onRoof = pick.level !== undefined && pick.level >= b.levels;
      const shown = pinned === null ? '' : onRoof ? ' · roof' : ` · storey ${level + 1}`;
      lines.push(`${b.name} · ${storeys}${shown}${isGlasshouse(this.game.buildings, b) ? ' · glasshouse' : ''}`);
      if (gateLine) lines.push(gateLine);
      const side = nearestSide(pick.x, pick.y, pick.wx, pick.wy);
      const wall = (gateLine && level === 0) || onRoof ? undefined : this.game.buildings.wall(level, pick.x, pick.y, side);
      if ((gateLine && level === 0) || onRoof) {
        // Said above, with its state; and on the roof's own level, the roof is all there is.
      } else if (wall) {
        // What it is to you: a hidden door you hold no key to is the solid wall it looks like (`gates.ts`).
        const seen = this.game.buildings.seenType(wall);
        const type = WALL_TYPE_BY_ID.get(seen)?.name.toLowerCase() ?? seen;
        const mat = MATERIALS.find((m) => m.id === wall.material)?.name.toLowerCase() ?? wall.material;
        const gate = seen === 'portcullis' && isDone(wall) ? ` · ${portcullisState(wall)}` : '';
        lines.push(`${SIDE_NAMES[side]} wall: ${type} ${mat}${isDone(wall) ? '' : ` · ${Math.round(progressOf(wall) * 100)}% built`}${gate}`);
      } else {
        lines.push(`${SIDE_NAMES[side]} side: no wall`);
      }
      const floor = onRoof ? undefined : this.game.buildings.floor(level, pick.x, pick.y);
      if (floor) {
        const k = floorKind(floor);
        const mat = MATERIALS.find((m) => m.id === floor.material)?.name.toLowerCase() ?? floor.material;
        lines.push(`${k === 'ladder' ? 'ladder' : `${mat} ${floorName(floor)}`}${isDone(floor) ? '' : ` · ${Math.round(progressOf(floor) * 100)}% built`}`);
      }
      // The roof: on Auto, and on its own level when that is pinned (`storeyview.ts`); not on a storey under it.
      const roof = this.game.buildings.floor(b.levels, pick.x, pick.y);
      if (pinned === null || onRoof) {
        const shape = onRoof ? `${roofShapeDef(b).name.toLowerCase()} ` : '';
        if (roof) lines.push(`${shape}${roof.material === GLASS_ROOF.id ? 'glass roof' : 'roof'}${isDone(roof) ? '' : ` · ${Math.round(progressOf(roof) * 100)}% built`}`);
        else if (onRoof) lines.push('roof: not planned');
      }
    }
    const counterLine = aloft ? null : counterTip(this.game, pick);
    if (counterLine) lines.push(counterLine);
    // A jetty over the tile, and a column on the corner nearest the pointer (`frameMenu.ts`).
    lines.push(...frameHoverLines(this.game, pick));
    const pile = aloft ? [] : this.game.groundAt(pick.x, pick.y);
    if (pile.length === 1) {
      const it = pile[0];
      lines.push(`On the ground: ${itemName(it).toLowerCase()}${it.count > 1 ? ` ×${it.count}` : ''}${it.dmg >= 1 ? ` · ${Math.round(it.dmg)}% damage` : ''} · ${rotLine(this.game, it, pick.x, pick.y)}`);
    } else if (pile.length) {
      // The first of them to go, which is the one worth knowing about.
      const soonest = Math.min(...pile.map((it) => rotSeconds(this.game, it, pick.x, pick.y)));
      lines.push(`On the ground: ${pile.length} items · the first rots in ${rotSaid(soonest)}`);
    }
    this.tooltip.show(sx, sy, lines);
  }

  /**
   * Every window there is, under the one button that opens them.
   *
   * Thirteen buttons across the top of a phone was four screens of sideways
   * scrolling; one button and a list is the same thirteen doors without the
   * wall of them. Each row says which key it answers to, so the menu teaches
   * its own way out of itself — and whether the window is open already, since
   * the row toggles rather than opens and a list that will not say which way
   * it is about to go is a list you have to try.
   */
  showWindowMenu(x: number, y: number): void {
    // A window that was never made here -- the Island keeper, for anybody who
    // does not keep the island -- is not on the list.
    const entries: MenuItem[] = WINDOWS.filter((wdw) => this.windows.get(wdw.id)).map((wdw) => {
      const open = this.windows.get(wdw.id)?.isOpen ?? false;
      const codes = this.keys.codes(wdw.bind);
      return {
        label: wdw.label,
        checked: open,
        keys: codes.length ? keyName(codes[0]) : undefined,
        onSelect: () => this.toggleWindow(wdw.id),
      };
    });
    this.menu.show(x, y, 'Windows', entries);
  }

  /**
   * The emotes, in the middle of the screen where the key left the cursor.
   *
   * A menu rather than a key each: two of them is a pair of bindings and five
   * is a keyboard nobody can remember, and this costs one keypress more and
   * never runs out of room. Each row says the command that does the same
   * thing, so the menu teaches the way out of itself.
   */
  showEmotes(): void {
    const cam = this.renderer.camera;
    this.menu.show(cam.width / 2, cam.height / 2, 'Emotes',
      EMOTES.map((e) => ({
        label: e.label,
        note: `/${e.id}`,
        onSelect: () => this.game.emote(e.id),
      })));
  }

  showTileMenu(pick: Pick, sx: number, sy: number): void {
    let built: { title: string; facts?: string[]; entries: MenuItem[] };
    try {
      built = this.menuFor(pick, (ground) => this.showTileMenu(ground, sx, sy));
    } catch (e) {
      // Said in the log and on the console rather than swallowed: a menu
      // that cannot be built is a bug, and one that took the click handler
      // down with it was reported as the game locking up.
      const why = e instanceof Error ? e.message : String(e);
      console.error('The menu for this could not be built', e);
      this.game.logMsg(`Menu failed: ${why}`, 'error');
      built = { title: 'Error', entries: [{ label: `Menu failed: ${why}`, disabled: true }] };
    }
    this.menu.show(sx, sy, built.title, built.entries, built.facts);
  }

  /**
   * Everything that can be done where you clicked, and what to call it. The
   * right-click menu and the tile window are the same list seen two ways, so
   * neither can fall behind the other.
   */
  menuFor(pick: Pick, go?: (ground: Pick) => void): { title: string; facts?: string[]; entries: MenuItem[] } {
    const built = this.pickMenu(pick);
    const aim = this.aimAt(pick);
    if (aim) built.entries.push(...(this.spellBar?.entriesFor(aim) ?? []));
    if (go) built.entries.push(...this.groundEntries(pick, go));
    return built;
  }

  /**
   * For a thing set down on the ground -- a wagon, a crate, a fire -- the way through to the ground: the tile it stands
   * on, and the tile behind it where the cursor was when that is another. A wagon is drawn over more than its own tile,
   * and without these the ground it stands on and covers could not be picked at all.
   */
  private groundEntries(pick: Pick, go: (ground: Pick) => void): MenuItem[] {
    if (pick.ground === undefined) return [];
    const named = (p: Pick): string => `${this.game.world.tileName(p.x, p.y)} (${p.x}, ${p.y})`;
    // On a pinned storey, its floor under it (`storeyview.ts`).
    const under: Pick = { x: pick.x, y: pick.y, wx: pick.wx, wy: pick.wy, cx: pick.cx, cy: pick.cy, ...(pick.level !== undefined ? { level: pick.level } : {}) };
    const out: MenuItem[] = [{ label: 'Ground under it', note: named(under), onSelect: () => go(under) }];
    const behind = pick.ground;
    if (behind.x !== pick.x || behind.y !== pick.y || behind.down) out.push({ label: 'Ground behind it', note: named(behind), onSelect: () => go(behind) });
    return out;
  }

  /**
   * What a spell off the bar would be cast at, for whatever was picked: a
   * person, a creature, a thing the island keeps in `placed`, or else the
   * ground of the tile.
   */
  private aimAt(pick: Pick): SpellAim | null {
    if (pick.peer !== undefined) return { kind: 'player', uid: pick.peer };
    if (pick.creature !== undefined) return { kind: 'creature', id: pick.creature };
    const placed = pick.furniture ?? pick.fire ?? pick.smelter ?? pick.kiln ?? pick.anvil ?? pick.post;
    if (placed !== undefined) return { kind: 'placed', id: placed };
    // Nor at a pinned storey's floor (`storeyview.ts`): a spell is cast at the ground.
    if (pick.crate !== undefined || pick.trap !== undefined || pick.bridge !== undefined || pick.down || (pick.level ?? 0) > 0) return null;
    return { kind: 'area', x: pick.x + 0.5, y: pick.y + 0.5 };
  }

  private pickMenu(pick: Pick): { title: string; facts?: string[]; entries: MenuItem[] } {
    if (pick.peer !== undefined) return this.personMenu(pick.peer);
    const creature = pick.creature !== undefined ? this.game.creatures.get(pick.creature) : undefined;
    if (creature) {
      return { title: `${creature.name} (${this.game.creatures.describe(creature)})`, entries: this.creatureEntries(creature.id) };
    }
    const crate = pick.crate !== undefined ? this.game.crates.get(pick.crate) : undefined;
    if (crate) {
      const ct: Target = { kind: 'crate', id: crate.id };
      const entries: MenuItem[] = [{ label: 'Open', onSelect: () => this.cratePanel.open(crate.id) }];
      for (const id of ['crate_take_all', 'pick_up_crate']) {
        const def = ACTION_BY_ID.get(id);
        if (!def) continue;
        const reason = def.check?.(ct, this.game) ?? null;
        entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => this.game.requestAction(def, ct) });
      }
      entries.push(...this.nameEntry(ct));
      return { title: crateName(crate), entries };
    }
    const fire = pick.fire !== undefined ? this.game.campfires.get(pick.fire) : undefined;
    if (fire) return { title: `Campfire (${fireState(fire)})`, entries: this.campfireEntries(fire) };
    const smelter = pick.smelter !== undefined ? this.game.smelters.get(pick.smelter) : undefined;
    if (smelter) return { title: `Smelter (${smelterState(smelter)})`, entries: this.smelterEntries(smelter) };
    const piece = pick.furniture !== undefined ? this.game.furniture.get(pick.furniture) : undefined;
    if (piece && isGrave(piece)) return { title: `${graveName(this.game, piece)} (${graveLine(this.game, piece)})`, entries: this.graveEntries(piece) };
    if (piece) {
      const state = rackSpots(piece) ? `${furnitureState(piece)} · ${this.rackLine(piece)}`
        : piece.kind === CREATURE_CRATE ? `${furnitureState(piece)} · ${crateLine(this.game, piece)}`
        : furnitureState(piece);
      return { title: `${furnitureName(piece)} (${state})`, entries: [...this.furnitureEntries(piece), ...this.nameEntry({ kind: 'furniture', id: piece.id })] };
    }
    const kilnHere = pick.kiln !== undefined ? this.game.kilns.get(pick.kiln) : undefined;
    if (kilnHere) return { title: `Kiln (${kilnState(kilnHere)})`, entries: this.kilnEntries(kilnHere) };
    const anvilHere = pick.anvil !== undefined ? this.game.anvils.get(pick.anvil) : undefined;
    if (anvilHere) return { title: `${anvilName(anvilHere)} (QL ${anvilHere.ql.toFixed(0)})`, entries: this.anvilEntries(anvilHere) };
    const postHere = pick.post !== undefined ? this.game.posts.get(pick.post) : undefined;
    if (postHere) return { title: `${postName(postHere)} (${postState(postHere, postKeep(this.game))})`, entries: [...this.postEntries(postHere), ...this.nameEntry({ kind: 'post', id: postHere.id })] };
    const trapHere = pick.trap !== undefined ? this.game.traps.get(pick.trap) : undefined;
    if (trapHere) return { title: `${trapName(trapHere)} (${trapState(trapHere, this.game)})`, entries: [...this.trapEntries(trapHere), ...this.nameEntry({ kind: 'trap', id: trapHere.id })] };
    const bridgeHere = pick.bridge !== undefined ? this.game.bridges.get(pick.bridge) : undefined;
    if (bridgeHere) return { title: `${bridgeName(bridgeHere)} (${bridgeState(bridgeHere)})`, entries: this.bridgeEntries(bridgeHere) };
    // Picked on a cellar's floor, looking into it: the cellar's own list.
    if (pick.down) return this.cellarMenu(pick);
    // Picked on the floor of a pinned storey over the ground: that storey's own list (`storeyview.ts`).
    if ((pick.level ?? 0) > 0) return this.storeyMenu(pick);
    // And on the ground while one is pinned, the ground's, without the hidden storeys' building work.
    const builds = (this.game.pinnedStorey() ?? 0) === 0;
    const target = { kind: 'tile' as const, x: pick.x, y: pick.y, cx: pick.cx, cy: pick.cy };
    const entries: MenuItem[] = [];
    entries.push(...this.settlementEntry(pick));
    // The settlement this tile is on, if it is one of yours: the whole menu
    // for one you founded, and what you are and the way off it for one you
    // were asked onto.
    const settled = this.game.deedOfMineAt(pick.x, pick.y);
    if (settled) entries.push(isFounder(settled) ? this.deedEntry() : this.citizenEntry(settled));
    // Somebody else's settlement, at its token: asking to live there.
    if (!settled) entries.push(...this.askToJoinEntry(pick.x, pick.y));
    // Laying a campfire on the block of subtiles under the cursor.
    const fireDef = ACTION_BY_ID.get('build_campfire');
    if (fireDef && this.game.inventory.count('shaft') >= FIRE_COST) {
      const [ax, ay] = fireAnchor(...subtileOf(pick.x, pick.y, pick.wx, pick.wy));
      const ft: Target = { ...target, sx: ax, sy: ay };
      const reason = fireDef.check?.(ft, this.game) ?? null;
      entries.push({
        label: `Build campfire here (spots ${ax + 1},${ay + 1} to ${ax + 2},${ay + 2})`,
        hint: reason ?? undefined,
        note: reason ? undefined : `Uses ${FIRE_COST} shafts`,
        disabled: !!reason,
        onSelect: () => this.game.requestAction(fireDef, ft),
      });
    }
    // Placing a carried crate on the subtile under the cursor.
    const crateItems = this.game.inventory.items.filter((it) => crateKindOfItem(it.id));
    const placeDef = ACTION_BY_ID.get('place_crate');
    if (crateItems.length && placeDef) {
      const [sx0, sy0] = subtileOf(pick.x, pick.y, pick.wx, pick.wy);
      for (const it of crateItems) {
        const pt: Target = { ...target, sx: sx0, sy: sy0, itemUid: it.uid };
        const reason = placeDef.check?.(pt, this.game) ?? null;
        entries.push({ label: `Place ${itemName(it).toLowerCase()} here (spot ${sx0 + 1},${sy0 + 1})`, hint: reason ?? undefined, disabled: !!reason, onSelect: () => this.game.requestAction(placeDef, pt) });
      }
    }
    // Driving a carried work post into the spot under the cursor.
    const postDef = ACTION_BY_ID.get('place_post');
    const postItems = this.game.inventory.items.filter((it) => it.id === 'work_post');
    if (postDef && postItems.length) {
      const [px0, py0] = subtileOf(pick.x, pick.y, pick.wx, pick.wy);
      for (const it of postItems) {
        const pt: Target = { ...target, sx: px0, sy: py0, itemUid: it.uid };
        const reason = postDef.check?.(pt, this.game) ?? null;
        entries.push({
          label: `Drive ${itemName(it).toLowerCase()} in here (spot ${px0 + 1},${py0 + 1})`,
          note: reason ? undefined : `${Math.round(postLife(it.ql) * postKeep(this.game) / 60)} min · reaches ${postRadius(it.ql)} tiles`,
          hint: reason ?? undefined,
          disabled: !!reason,
          onSelect: () => this.game.requestAction(postDef, pt),
        });
      }
    }
    // Sitting down on the rug, choosing a way, and calling on what it gave.
    const sit = ACTION_BY_ID.get('meditate');
    if (sit && this.game.inventory.has('rug') && pick.x === this.game.player.tileX && pick.y === this.game.player.tileY) {
      const g = this.game;
      const med = g.skills.get(MEDITATION);
      const why = sit.check?.(target, g) ?? null;
      const worth = sittingWorth(g);
      entries.push({
        label: 'Meditate',
        note: why ? undefined : `meditation ${med.toFixed(1)} · meditation gain and Calm ×${worth.place.toFixed(2)} at this spot · +${Math.floor(worth.calm)} Calm`,
        hint: why ?? undefined,
        disabled: !!why,
        onSelect: () => g.requestAction(sit, target),
      });
      const choose = ACTION_BY_ID.get('choose_path');
      if (choose && !g.player.way) {
        const ready = med >= CHOOSE_AT;
        entries.push({
          label: 'Choose a path',
          hint: ready ? 'Permanent.' : `Need meditation ${CHOOSE_AT}.`,
          disabled: !ready,
          children: ready
            ? PATH_LIST.map((path) => ({
                label: path.name,
                note: path.moved
                  ? PATH_TIER_AT.map((at, i) => `${at}: ${picksOf(path.id, i + 1).map((k) => k.name).join(' / ')}`).join(' · ')
                  : path.steps.map((st) => `${st.at}: ${st.name}`).join(' · '),
                hint: path.note,
                onSelect: () => g.requestAction(choose, { ...target, material: path.id }),
              }))
            : undefined,
        });
      }
      if (g.player.way && PATHS[g.player.way].moved) {
        // A path moved onto tiers: its picks are taken in the Faith window, and its techniques cast off the bar.
        const way = PATHS[g.player.way];
        const next = PATH_TIER_AT.find((at) => med < at);
        entries.push({
          label: `Path: ${way.name}`,
          note: `Calm ${Math.floor(g.player.calm)} of ${Math.floor(g.calmCap())} · ${next !== undefined ? `next path tier at meditation ${next}` : 'every path tier open'}`,
          onSelect: () => this.windows.get('faith')?.open(),
        });
        // Playing by yourself there is no spell bar, so the techniques you hold are called from here.
        const mine = g.player.picks.filter((id) => PATH_PICK_BY_ID.get(id)?.kind === 'technique' && g.holds(id));
        if (!this.island && mine.length) {
          entries.push({
            label: 'Use path ability',
            children: mine.map((id) => {
              const k = PATH_PICK_BY_ID.get(id);
              const reason = g.techniqueRefusal(id);
              return {
                label: k?.name ?? id, note: `${k?.cost ?? 0} Calm`, hint: reason ?? undefined, disabled: !!reason,
                onSelect: () => {
                  const why = g.castTechnique(id);
                  if (why) g.logMsg(why, 'error');
                },
              };
            }),
          });
        }
      } else if (g.player.way) {
        const way = PATHS[g.player.way];
        const next = nextStep(g.player.way, med);
        entries.push({ label: `Path: ${way.name}`, note: next ? `next: ${next.name} at ${next.at}` : 'complete', disabled: true });
        const use = ACTION_BY_ID.get('use_ability');
        const able = abilitiesOf(g.player.way, med);
        if (use && able.length) {
          entries.push({
            label: 'Use path ability',
            children: able.map((st) => {
              const t: Target = { ...target, material: st.ability?.id };
              const reason = use.check?.(t, g) ?? null;
              return { label: st.name, note: st.note, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(use, t) };
            }),
          });
        }
      }
    }
    // Throwing a bridge from where you are standing to the tile under the cursor.
    entries.push(...this.bridgeFromHere(pick, target));
    // Leading an aqueduct to the pool, pond, fountain or hollow under the cursor, from water straight out from it.
    entries.push(...aqueductMenu(this.game, pick.x, pick.y, target));
    // Setting a carried trap on the spot under the cursor.
    const trapSet = ACTION_BY_ID.get('set_trap');
    const trapItems = this.game.inventory.items.filter((it) => it.id === 'snare' || it.id === 'deadfall' || it.id === 'creel');
    if (trapSet && trapItems.length) {
      const [tx0, ty0] = subtileOf(pick.x, pick.y, pick.wx, pick.wy);
      for (const it of trapItems) {
        const tt: Target = { ...target, sx: tx0, sy: ty0, itemUid: it.uid };
        const reason = trapSet.check?.(tt, this.game) ?? null;
        const kind = TRAPS[it.id as 'snare' | 'deadfall' | 'creel'];
        entries.push({
          label: `Set ${itemName(it).toLowerCase()} here (spot ${tx0 + 1},${ty0 + 1})`,
          note: reason ? undefined : `${Math.round(trapLife(it.id as 'snare' | 'deadfall' | 'creel', it.ql) * trapKeep(this.game, it.id as 'snare' | 'deadfall' | 'creel') / 60)} min · ${kind.water ? `holds ${Math.round((kind.hold ?? 8) * markOf(it, 'hold'))} fish` : `holds to taming ${Math.round(kind.holds * (0.6 + Math.max(1, Math.min(100, it.ql)) / 250))}`}`,
          hint: reason ?? undefined,
          disabled: !!reason,
          onSelect: () => this.game.requestAction(trapSet, tt),
        });
      }
    }
    // Setting carried furniture down on the block of subtiles under the cursor.
    entries.push(...this.furnitureDownEntries());
    // Sowing on a tilled field: pick from the seeds you carry. A Farmer who has
    // learned to sow a patch is offered that too, from the same seeds.
    const seedsCarried = this.game.inventory.items.filter((it) => CROP_BY_SEED.has(it.id));
    const sowMenu = (def: ActionDef, label: string, note: (crop: CropDef) => string): void => {
      entries.push({
        label,
        disabled: !seedsCarried.length,
        hint: seedsCarried.length ? undefined : 'No seeds carried (from foraging and botanizing).',
        children: seedsCarried.length
          ? seedsCarried.map((it) => {
              const crop = CROP_BY_SEED.get(it.id)!;
              const st: Target = { ...target, itemUid: it.uid };
              const reason = def.check?.(st, this.game) ?? null;
              return {
                label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it),
                note: note(crop),
                hint: reason ?? undefined,
                disabled: !!reason,
                onSelect: () => this.game.requestAction(def, st),
              };
            })
          : undefined,
      });
    };
    const sowDef = ACTION_BY_ID.get('plant_seed');
    if (sowDef && sowDef.applies(target, this.game) && !this.game.cropAt(pick.x, pick.y)) {
      // At the pace this sowing would grow at: a Farmer's Fast Growth and Crop Rotation.
      // Under glass at the glasshouse's share in any season, and in the open at the season's (`glasshouse.ts`).
      // And on a Season's Hand's clock for a sower with Love's Season's Hand, which a winter does not stop.
      const clock = underGlass(this.game.buildings, pick.x, pick.y) ? 'glass' : this.game.pathFx('winter', 0) > 0 ? 'hand' : 'field';
      sowMenu(sowDef, 'Sow', (crop) => stageNote(crop.name, crop.stageSeconds * sownPace(this.game, pick.x, pick.y, crop.id), clock, this.game.wallNow()));
    }
    const patchDef = ACTION_BY_ID.get('sow_patch');
    if (patchDef && patchDef.applies(target, this.game)) {
      const r = this.game.perk('sow_patch', 0);
      const empty = emptyFields(this.game, pick.x, pick.y, r).length;
      sowMenu(patchDef, 'Sow a patch', (crop) => `${crop.name} on ${empty} empty ${empty === 1 ? 'field' : 'fields'} of the ${2 * r + 1}×${2 * r + 1}`);
    }
    const smelterDef = ACTION_BY_ID.get('place_smelter');
    const smelterItem = this.game.inventory.find('smelter');
    if (smelterDef && smelterItem) {
      const [ax, ay] = smelterAnchor(...subtileOf(pick.x, pick.y, pick.wx, pick.wy));
      const st: Target = { ...target, sx: ax, sy: ay, itemUid: smelterItem.uid };
      const reason = smelterDef.check?.(st, this.game) ?? null;
      entries.push({
        label: `Set the smelter down here (spots ${ax + 1},${ay + 1} to ${ax + 3},${ay + 2})`,
        note: reason ? undefined : `QL ${smelterItem.ql.toFixed(0)}`,
        hint: reason ?? undefined,
        disabled: !!reason,
        onSelect: () => this.game.requestAction(smelterDef, st),
      });
    }
    const kilnDef = ACTION_BY_ID.get('place_kiln');
    const kilnItem = this.game.inventory.find('kiln');
    if (kilnDef && kilnItem) {
      const [ax, ay] = kilnAnchor(...subtileOf(pick.x, pick.y, pick.wx, pick.wy));
      const st: Target = { ...target, sx: ax, sy: ay, itemUid: kilnItem.uid };
      const reason = kilnDef.check?.(st, this.game) ?? null;
      entries.push({
        label: `Set the kiln down here (spots ${ax + 1},${ay + 1} to ${ax + 2},${ay + 2})`,
        note: reason ? undefined : `QL ${kilnItem.ql.toFixed(0)}`,
        hint: reason ?? undefined,
        disabled: !!reason,
        onSelect: () => this.game.requestAction(kilnDef, st),
      });
    }
    const anvilDef = ACTION_BY_ID.get('place_anvil');
    const anvilItem = this.game.inventory.find('anvil');
    if (anvilDef && anvilItem) {
      const [ax, ay] = anvilAnchor(...subtileOf(pick.x, pick.y, pick.wx, pick.wy));
      const st: Target = { ...target, sx: ax, sy: ay, itemUid: anvilItem.uid };
      const reason = anvilDef.check?.(st, this.game) ?? null;
      entries.push({
        label: `Set the anvil down here (spots ${ax + 1},${ay + 1} to ${ax + 2},${ay + 2})`,
        hint: reason ?? undefined,
        disabled: !!reason,
        onSelect: () => this.game.requestAction(anvilDef, st),
      });
    }
    const pile = this.game.groundAt(pick.x, pick.y);
    const pickUp = ACTION_BY_ID.get('pick_up');
    if (pile.length && pickUp) {
      const children: MenuItem[] = pile.map((item) => ({
        label: (item.count > 1 ? `${itemName(item)} (${item.count})` : itemName(item)) + (item.dmg >= 1 ? ` · dmg ${Math.round(item.dmg)}` : ''),
        // How long it has lying here: nothing rots in a pack or a store.
        note: rotLine(this.game, item, pick.x, pick.y),
        onSelect: () => this.game.requestAction(pickUp, { kind: 'ground', x: pick.x, y: pick.y, uid: item.uid }),
      }));
      if (pile.length > 1) children.push({ label: 'Everything', onSelect: () => this.game.requestAction(pickUp, { kind: 'ground', x: pick.x, y: pick.y, uid: null }) });
      entries.push({ label: 'Pick up', children });
    }
    // For a keeper of the island: a pile nobody is coming back for, deleted.
    if (pile.length && this.keeper && this.island) {
      const isle = this.island;
      const things = pile.reduce((n, it) => n + it.count, 0);
      const { x, y } = pick;
      entries.push({
        label: 'Clear this pile',
        note: `Deletes ${things} ${things === 1 ? 'thing' : 'things'} in ${pile.length} ${pile.length === 1 ? 'stack' : 'stacks'}, contents included`,
        onSelect: () => void (async () => {
          if (!(await this.game.hooks.confirm(clearQuestion(x, y, pile.length, things)))) return;
          const why = await isle.keeperClear(x, y);
          if (why) this.game.logMsg(why, 'error');
        })(),
      });
    }
    // Anything else that can be done to a thing lying here, such as butchering a corpse.
    for (const item of pile) {
      const gt: Target = { kind: 'ground', x: pick.x, y: pick.y, uid: item.uid };
      for (const { def, reason } of this.game.actionsFor(gt)) {
        if (def.id === 'pick_up') continue;
        entries.push({
          label: `${def.label} the ${itemName(item).toLowerCase()}`,
          hint: reason ?? undefined,
          note: def.id === 'butcher' ? butcherPreview(this.game, item) : undefined,
          disabled: !!reason,
          onSelect: () => this.game.requestAction(def, gt),
        });
      }
    }
    // A shop counter on a border of this tile: looked at, bought from, and its till.
    entries.push(...counterEntries(this.game, pick, this.counterWays()));
    const building = this.game.buildings.buildingAt(pick.x, pick.y);
    if (building && builds) entries.push(...this.buildingEntries(pick));
    for (const { def, reason } of this.game.actionsFor(target)) {
      // Slabs come in four stones and they do not look alike: choose which goes down.
      if (def.id === 'pave_slabs') {
        const slabs = this.game.inventory.items.filter((it) => SLAB_BY_ITEM.has(it.id));
        if (slabs.length > 1) {
          entries.push({
            label: def.label,
            children: slabs.map((it) => {
              const st: Target = { ...target, itemUid: it.uid };
              const why = def.check?.(st, this.game) ?? null;
              return { label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it), hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(def, st) };
            }),
          });
          continue;
        }
      }
      // A flight goes down in one stone or one wood: choose which, when more than one is carried.
      if (def.id === 'lay_steps' || def.id === 'lay_timber_steps') {
        const stacks = this.game.inventory.items.filter((it) => (def.id === 'lay_steps' ? SLAB_BY_ITEM.has(it.id) : it.id === 'plank') && !it.locked);
        if (stacks.length > 1) {
          entries.push({
            label: def.label,
            children: stacks.map((it) => {
              const st: Target = { ...target, itemUid: it.uid };
              const why = def.check?.(st, this.game) ?? null;
              return { label: def.labelFor?.(st, this.game) ?? itemName(it), note: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it), hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(def, st) };
            }),
          });
          continue;
        }
      }
      // Change tile: one option per dirt, clay or sand carried.
      if (def.id === 'drop_dirt') {
        const kinds = SPOIL_ORDER.map((id) => this.game.inventory.items.filter((it) => it.id === id && !it.locked)).filter((s) => s.length > 0);
        if (kinds.length > 0) {
          entries.push({
            label: def.label,
            children: kinds.map((stacks) => {
              const st: Target = { ...target, itemUid: stacks[0].uid };
              const why = def.check?.(st, this.game) ?? null;
              const n = stacks.reduce((sum, it) => sum + it.count, 0);
              return { label: `${itemName(stacks[0])} (${n})`, hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(def, st) };
            }),
          });
          continue;
        }
      }
      // And sprouts, for the same reason: nine species, and a planted one is
      // what stands there for the next twenty years. A graft chooses among
      // the three that bear.
      if (def.id === 'plant' || def.id === 'graft') {
        const sprouts = this.game.inventory.items.filter((it) => it.id === 'sprout' && (def.id === 'plant' || fruitSprout(it)));
        if (sprouts.length > 1) {
          entries.push({
            label: def.label,
            children: sprouts.map((it) => {
              const st: Target = { ...target, itemUid: it.uid };
              const why = def.check?.(st, this.game) ?? null;
              return { label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it), hint: why ?? undefined, disabled: !!why, onSelect: () => this.game.requestAction(def, st) };
            }),
          });
          continue;
        }
      }
      entries.push(this.jobEntry(def, target, reason, def.labelFor?.(target, this.game) ?? def.label));
    }
    if (!building && builds) entries.push(...this.buildingEntries(pick));
    entries.push(...this.markEntries(pick));
    // Hanging one of this tile's jobs on the belt, to be pressed anywhere after.
    const hangable = this.game.actionsFor(target).filter((a) => pinnable(a.def));
    if (hangable.length && this.game.beltLoops()) {
      entries.push({
        label: 'Hang action on belt',
        children: hangable.map(({ def }) => ({ label: def.label, children: pinEntry(this.game, { action: def.id }).children })),
      });
    }
    const title = building ? `${building.name} (${pick.x}, ${pick.y})` : `${this.game.world.tileName(pick.x, pick.y)} (${pick.x}, ${pick.y})`;
    /*
     * What is true of the ground, above the list of what can be done to it.
     *
     * Where the corner you picked stands, first, because half the list is
     * corner work and the dot on the ground says which corner without saying
     * how high it is. Then what a prospector read, when anybody has read it.
     * Both were mouseover lines, and neither was readable at all with a
     * finger.
     */
    const reading = groundReading(this.game, pick.x, pick.y);
    // And the slab, if there is one: a tile whose top is somewhere other than
    // the ground has to say where, or nothing else on this list makes sense.
    const slab = this.game.foundations.size ? this.game.foundationAt(pick.x, pick.y) : undefined;
    const facts = [
      cornerReading(this.game, pick.cx, pick.cy),
      ...(slab ? [`Concrete foundation · ${foundationState(slab)}`] : []),
      ...(reading ? [reading] : []),
      ...yieldLines(this.game, pick.x, pick.y),
    ];
    return { title, facts, entries };
  }

  /**
   * The list for a tile of a pinned storey over the ground (`storeyview.ts`): that storey's building work, the
   * furniture you carry to set down on it, and marks. Nothing of the ground under it, and no spells.
   */
  private storeyMenu(pick: Pick): { title: string; facts?: string[]; entries: MenuItem[] } {
    const g = this.game;
    const level = pick.level ?? 0;
    const host = g.buildings.buildingAt(pick.x, pick.y) ?? storeyHost(g, pick.x, pick.y, level);
    const onRoof = !!host && g.buildings.buildingAt(pick.x, pick.y) === host && level >= host.levels;
    const entries: MenuItem[] = [...this.buildingEntries(pick, level)];
    entries.push(...this.bridgeFromHere(pick, { kind: 'tile', x: pick.x, y: pick.y, cx: pick.cx, cy: pick.cy }));
    if (!onRoof && g.standable(pick.x, pick.y, level)) entries.push(...this.furnitureDownEntries());
    entries.push(...this.markEntries(pick));
    const where = onRoof ? 'roof' : `storey ${level + 1}`;
    return { title: `${host ? `${host.name} · ` : ''}${where} (${pick.x}, ${pick.y})`, entries };
  }

  /**
   * A bridge from where you are standing to the tile under the cursor, by material and lanes: on the ground's list and
   * on a pinned storey's (`storeyMenu`), where a walkway between two towers is thrown from one roof to the other.
   */
  private bridgeFromHere(pick: Pick, target: Extract<Target, { kind: 'tile' }>): MenuItem[] {
    const planBridge = ACTION_BY_ID.get('plan_bridge');
    if (planBridge && (pick.x !== this.game.player.tileX || pick.y !== this.game.player.tileY)) {
      // An aqueduct is not thrown from a bank but led to where it pours (`aqueductMenu`).
      const g = this.game;
      const billSaid = (bill: Array<[string, number]>, k = 1): string => bill.map(([id, n]) => `${n * k} ${itemName({ uid: 0, id, ql: 1, dmg: 0, count: 1 }).toLowerCase()}`).join(', ');
      const [ax, ay] = [g.player.tileX, g.player.tileY];
      // Lanes on offer: one; two, the second either side of the line; three. Labels, and what each lets over.
      const widths: Array<{ width: number; side?: Side; label: string; crosses: string }> = [
        { width: 1, label: '1 lane', crosses: 'carts' },
        ...[1, -1].map((k) => ({ width: WAGON_WIDTH, side: laneSide(ax, ay, pick.x, pick.y, k), label: `${WAGON_WIDTH} lanes, ${SIDE_NAMES[laneSide(ax, ay, pick.x, pick.y, k)]}`, crosses: 'carts, wagons' })),
        { width: STALL_WIDTH, label: `${STALL_WIDTH} lanes`, crosses: 'carts, wagons, outer-lane furniture' },
      ];
      const hidden = (reason: string | null): boolean => reason !== null && /runs straight|nothing between|a gap, it is ground|dry, solid ground/.test(reason);
      const options = THROWN.map((kind) => {
        const def = BRIDGES[kind];
        if (!isMaterialBridge(kind)) {
          const reason = planBridge.check?.({ ...target, material: kind }, g) ?? null;
          return hidden(reason) ? null : {
            label: def.name,
            note: reason ? undefined : `${billSaid(def.bill)} a span${def.winch ? ` · the first also ${billSaid(def.winch)}` : ''} · ${def.carts ? 'carts cross' : 'foot only'}`,
            hint: reason ?? undefined,
            disabled: !!reason,
            onSelect: () => g.requestAction(planBridge, { ...target, material: kind }),
          };
        }
        const lanes = widths.map((w) => {
          const t: Target = { ...target, material: kind, width: w.width, ...(w.side ? { side: w.side } : {}) };
          return { w, t, reason: planBridge.check?.(t, g) ?? null };
        });
        if (lanes.every((l) => hidden(l.reason))) return null;
        return {
          label: def.name,
          note: `max ${def.span} tiles · bay ${def.bay} · max drop ${def.storeys} storeys`,
          children: lanes.map(({ w, t, reason }) => ({
            label: w.label,
            note: reason ? undefined : `${billSaid(def.bill, w.width)} a span · a pier ${billSaid(def.bill)} a storey of drop · ${w.crosses}`,
            hint: reason ?? undefined,
            disabled: !!reason,
            onSelect: () => g.requestAction(planBridge, t),
          })),
        };
      }).filter((o): o is NonNullable<typeof o> => o !== null);
      if (options.length) return [{ label: 'Build bridge from here', children: options }];
    }
    return [];
  }

  /** Setting a carried piece of furniture down: it follows the cursor from here, Q and E turn it, a click sets it down. */
  private furnitureDownEntries(): MenuItem[] {
    const carried = this.game.inventory.items.filter((it) => isFurniture(it.id));
    if (!ACTION_BY_ID.get('place_furniture') || !carried.length) return [];
    return [{
      label: 'Set furniture down',
      children: carried.map((it) => ({
        label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it),
        note: 'follows the cursor · Q/E rotate · click to place',
        onSelect: () => this.startPlacing(it),
      })),
    }];
  }

  /** Pinning a name to a spot on the map, or the one there renamed, recoloured or rubbed off. */
  private markEntries(pick: Pick): MenuItem[] {
    const entries: MenuItem[] = [];
    // Pinning a name to this spot, or rubbing one off.
    const here = this.game.markNear(pick.x, pick.y, 1.5);
    if (here) {
      entries.push({
        label: `Mark: ${here.name}`,
        children: [
          {
            label: 'Rename',
            onSelect: () => void (async () => {
              const said = await this.game.hooks.prompt('Mark name:', here.name);
              if (said !== null) this.game.renameMark(here.id, said);
            })(),
          },
          { label: 'Delete mark', onSelect: () => this.game.removeMark(here.id) },
          ...MARK_COLOURS.map((c) => ({
            label: c.name,
            note: c.note,
            onSelect: () => {
              this.game.recolourMark(here.id, c.id);
            },
          })),
        ],
      });
    } else {
      entries.push({
        label: 'Mark on map',
        children: MARK_COLOURS.map((c) => ({
          label: c.name,
          note: c.note,
          onSelect: () => void (async () => {
            const said = await this.game.hooks.prompt(`Mark name (${pick.x}, ${pick.y}):`, '');
            if (said !== null) this.game.addMark(pick.x, pick.y, said, c.id);
          })(),
        })),
      });
    }
    return entries;
  }

  /**
   * The floor of a cellar, picked while looking into it: what lies there and
   * can be picked up, a crate or a piece to set down, and the jobs on the
   * tile that are done from down there -- digging out, mining out or filling
   * in the next tile of it, and looking at it. Everything else on a tile is
   * work on the ground up top.
   */
  private cellarMenu(pick: Pick): { title: string; facts?: string[]; entries: MenuItem[] } {
    const g = this.game;
    const { x, y } = pick;
    const target = { kind: 'tile' as const, x, y, cx: pick.cx, cy: pick.cy };
    const entries: MenuItem[] = [];
    const crateItems = g.inventory.items.filter((it) => crateKindOfItem(it.id));
    const placeDef = ACTION_BY_ID.get('place_crate');
    if (crateItems.length && placeDef) {
      const [sx0, sy0] = subtileOf(x, y, pick.wx, pick.wy);
      for (const it of crateItems) {
        const pt: Target = { ...target, sx: sx0, sy: sy0, itemUid: it.uid };
        const reason = cellarReason(g, placeDef, pt);
        entries.push({ label: `Place ${itemName(it).toLowerCase()} here (spot ${sx0 + 1},${sy0 + 1})`, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(placeDef, pt) });
      }
    }
    const carried = g.inventory.items.filter((it) => isFurniture(it.id));
    if (ACTION_BY_ID.get('place_furniture') && carried.length) {
      entries.push({
        label: 'Set furniture down',
        children: carried.map((it) => ({
          label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it),
          note: 'follows the cursor · Q/E rotate · click to place',
          onSelect: () => this.startPlacing(it),
        })),
      });
    }
    const pile = g.groundAt(x, y, CELLAR_LEVEL);
    const pickUp = ACTION_BY_ID.get('pick_up');
    if (pile.length && pickUp) {
      const children: MenuItem[] = pile.map((it) => {
        const t: Target = { kind: 'ground', x, y, uid: it.uid, down: true };
        const reason = cellarReason(g, pickUp, t);
        return {
          label: (it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it)) + (it.dmg >= 1 ? ` · dmg ${Math.round(it.dmg)}` : ''),
          hint: reason ?? undefined,
          disabled: !!reason,
          onSelect: () => g.requestAction(pickUp, t),
        };
      });
      if (pile.length > 1) children.push({ label: 'Everything', onSelect: () => g.requestAction(pickUp, { kind: 'ground', x, y, uid: null, down: true }) });
      entries.push({ label: 'Pick up', children });
    }
    for (const { def, reason } of g.actionsFor(target)) {
      if (targetFloor(g, def.id, target) !== null) continue;
      entries.push(this.jobEntry(def, target, reason, def.labelFor?.(target, g) ?? def.label));
    }
    const building = g.buildings.buildingAt(x, y);
    const c = g.buildings.cellar(x, y);
    const facts = c ? [`Cellar · ${metres(c.dug)} m of ${metres(CELLAR_DEPTH)} m dug · ${pile.length ? `${pile.reduce((n, it) => n + it.count, 0)} lying here` : 'nothing lying here'}`] : [];
    return { title: `${building ? `Cellar of ${building.name}` : 'Cellar'} (${x}, ${y})`, facts, entries };
  }

  /** Feeding, lighting and cooking at a campfire. */
  private campfireEntries(fire: PlacedCampfire): MenuItem[] {
    const g = this.game;
    const ft: Target = { kind: 'campfire', id: fire.id };
    const entries: MenuItem[] = [];
    const fuelDef = ACTION_BY_ID.get('fuel_campfire');
    const wood = g.stockChoices((it) => isFuel(it.id));
    if (fuelDef && wood.length) entries.push({ label: 'Fuel', children: wood.map((s) => this.stackRow(fuelDef, ft, s)) });
    for (const id of ['light_campfire', 'put_out_campfire', 'take_apart_campfire']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(ft, g)) continue;
      const reason = def.check?.(ft, g) ?? null;
      entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, ft) });
    }
    entries.push({ label: 'Cook', children: this.cookEntries() });
    return entries;
  }

  /** Everything a lit fire or a hot oven could turn into dinner. */
  private cookEntries(): MenuItem[] {
    const g = this.game;
    // What is at hand, carried or stored within reach, listed once for each
    // reach the dishes ask for: a Cook's Pantry Reach takes cooking further.
    const byReach = new Map<number, readonly CraftStock[]>();
    const stockOf = (r: Recipe): readonly CraftStock[] => {
      const reach = reachFor(g, r);
      let found = byReach.get(reach);
      if (!found) byReach.set(reach, (found = reach > CRAFT_REACH ? g.craftStock(undefined, false, reach) : g.craftStock()));
      return found;
    };
    return RECIPES.filter((r) => r.station === 'campfire').map((r) => {
      const stock = stockOf(r);
      const def = ACTION_BY_ID.get(r.id);
      const st = recipeStatus(r, g, undefined, stock);
      const material = stock.find((s) => s.item.id === r.inputs[0].item)?.item;
      const reason = def ? recipeReason(r, g, undefined, stock) : 'Not possible.';
      return {
        label: `${itemDef(r.result).name}${g.madeAGo(r) > 1 ? ` × ${g.madeAGo(r)}` : ''}`,
        note: recipeNeeds(r),
        hint: reason ?? undefined,
        disabled: !!reason || !def || !material,
        onSelect: () => {
          if (def && material) g.requestAction(def, { kind: 'item', uid: material.uid }, st.max);
        },
      };
    });
  }

  /**
   * One stack on a station's menu, to put in one at a time or all at once:
   * fuel for a fire, ore or scrap for a smelter, clay for a kiln. A stack in
   * one of your stores rather than on you says which store it is in.
   */
  private stackRow(def: ActionDef, target: Target, stack: CraftStock): MenuItem {
    const g = this.game;
    const it = stack.item;
    const put = (count: number) => (): void => g.requestAction(def, { ...target, itemUid: it.uid, count } as Target);
    return {
      label: `${it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it)} · QL ${it.ql.toFixed(1)}`,
      note: storedIn(stack),
      children: it.count > 1 ? [{ label: 'One', onSelect: put(1) }, { label: `All (${it.count})`, onSelect: put(it.count) }] : undefined,
      onSelect: it.count > 1 ? undefined : put(1),
    };
  }

  /** Fuelling, charging and drawing off a smelter. */
  private smelterEntries(s: PlacedSmelter): MenuItem[] {
    const g = this.game;
    const st: Target = { kind: 'smelter', id: s.id };
    const entries: MenuItem[] = [];
    /*
     * Everything the furnace takes in -- fuel, ore, scrap and metal -- comes
     * from the same stock a craft spends: the pack, a bag on your back, and
     * your stores within reach, a wagon drawn up beside it included. The
     * moulds are tools, and are the ones you carry.
     */
    // As far as a craft reaches, or as far as a Smith's Forge Reach.
    const reach = g.forgeReach();
    const fuelDef = ACTION_BY_ID.get('fuel_smelter');
    const fuel = g.stockChoices((it) => isFuel(it.id), reach);
    if (fuelDef && fuel.length) entries.push({ label: 'Fuel', children: fuel.map((k) => this.stackRow(fuelDef, st, k)) });
    const smeltDef = ACTION_BY_ID.get('smelt_ore');
    const ores = g.stockChoices((it) => isOreItem(it.id), reach);
    if (smeltDef) {
      entries.push({
        label: 'Smelt ore',
        disabled: !ores.length,
        hint: ores.length ? undefined : noneAtHand(g, 'no ore', reach),
        children: ores.length ? ores.map((k) => this.stackRow(smeltDef, st, k)) : undefined,
      });
    }
    // Scrap goes back into the fire: anything cast from metal, or hafted to a cast head.
    const meltDef = ACTION_BY_ID.get('melt_down');
    const scrap = g.stockChoices((it) => meltable(it), reach);
    if (meltDef) {
      entries.push({
        label: 'Melt down',
        disabled: !scrap.length,
        hint: scrap.length ? undefined : noneAtHand(g, 'nothing made of metal', reach),
        children: scrap.length ? scrap.map((k) => this.stackRow(meltDef, st, k)) : undefined,
      });
    }
    const castDef = ACTION_BY_ID.get('cast_anvil');
    // Lumps, and ingots, which count as their lumps (a Smith's Ingots).
    const lumps = g.stockChoices((it) => isMetalStock(it.id), reach);
    if (castDef && g.inventory.has('anvil_mould')) {
      entries.push({
        label: 'Cast an anvil',
        disabled: !lumps.length,
        hint: lumps.length ? undefined : noneAtHand(g, 'no metal', reach),
        children: lumps.length
          ? lumps.map((k) => {
              const it = k.item;
              const t: Target = { ...st, itemUid: it.uid };
              const reason = castDef.check?.(t, g) ?? null;
              return { label: metalLabel(it), note: storedIn(k), hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(castDef, t) };
            })
          : undefined,
      });
    }
    // Every other mould is poured here too, and cools into a casting for the anvil.
    const pourDef = ACTION_BY_ID.get('pour_mould');
    // In one order however the pack shifts as they are filled, and each with its QL, which is how two of a kind are told apart.
    const moulds = orderBy(g.inventory.items.filter((it) => isMould(it.id) && MOULD_BY_ID.get(it.id)?.makes !== 'anvil'), 'name');
    if (pourDef) {
      entries.push({
        label: 'Pour a mould',
        disabled: !moulds.length || !lumps.length,
        hint: !moulds.length ? 'No moulds carried.' : !lumps.length ? noneAtHand(g, 'no metal', reach) : undefined,
        children:
          moulds.length && lumps.length
            ? moulds.map((mould) => {
                const def = MOULD_BY_ID.get(mould.id)!;
                return {
                  label: `${itemName(mould)} · QL ${mould.ql.toFixed(1)}`,
                  note: `${itemDef(def.makes).name.toLowerCase()} · ${def.lumps} lump${def.lumps > 1 ? 's' : ''} · damage ${mould.dmg.toFixed(1)} · ${mouldUsesLeft(mould.ql, mould.dmg, markOf(mould, 'last'))} fillings left`,
                  children: lumps.map((k) => {
                    const lump = k.item;
                    const t: Target = { ...st, mouldUid: mould.uid, itemUid: lump.uid };
                    const reason = pourDef.check?.(t, g) ?? null;
                    // What this metal costs, which is not the same for all of
                    // them: a lump of the rare six weighs a tenth of an iron
                    // one, so a filling takes ten times as many.
                    const need = mouldLumps(def, metalOfBar(lump.id)?.id ?? '');
                    return {
                      label: `${metalLabel(lump)} · ${need} needed`,
                      note: storedIn(k),
                      hint: reason ?? undefined,
                      disabled: !!reason,
                      onSelect: () => g.requestAction(pourDef, t),
                    };
                  }),
                };
              })
            : undefined,
      });
    }
    // Bars out of lumps, for a Smith's Ingots.
    const ingotDef = ACTION_BY_ID.get('pour_ingot');
    if (ingotDef && ingotDef.applies(st, g)) {
      const loose = lumps.filter((k) => isLump(k.item.id));
      entries.push({
        label: ingotDef.label,
        disabled: !loose.length,
        hint: loose.length ? undefined : noneAtHand(g, 'no lumps', reach),
        note: `${INGOT_LUMPS} lumps to an ingot`,
        children: loose.length ? loose.map((k) => this.stackRow(ingotDef, st, k)) : undefined,
      });
    }
    for (const id of ['light_smelter', 'damp_smelter', 'smelter_take_all', 'take_ashes_smelter', 'pick_up_smelter']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(st, g)) continue;
      const reason = def.check?.(st, g) ?? null;
      entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, st) });
    }
    if (s.jobs.length) {
      const job = s.jobs[0];
      entries.push({ label: `In the furnace: ${jobName(job)}`, note: `${Math.ceil(job.left)} s left, ${s.jobs.length} total`, disabled: true });
    }
    if (s.output.length) entries.push({ label: `Finished: ${s.output.map((o) => `${o.count > 1 ? `${o.count} × ` : ''}${itemName(o).toLowerCase()}`).join(', ')}`, disabled: true });
    return entries;
  }

  /**
   * How loaded a rack is, in one line: spots taken, and the gross of what is
   * in the crates standing on it. A rack holds nothing itself, so without
   * this it reads as a piece of furniture with nothing in it however full it
   * is. Asked for as "show inventory gross (x/x)".
   */
  private rackLine(f: PlacedFurniture): string {
    const load = this.game.rackLoad(f);
    if (!load.crates) return `no crates · room ${load.spots}`;
    return `${load.crates} of ${load.spots} spots · ${load.units} / ${load.capacity} things`;
  }

  /** A crop as a look says it, in a field or a planter: its stage, when the next comes in real time, and what its tending earned you. */
  private cropLine(c: Crop): string {
    const g = this.game;
    return describeCrop(c, g.cropPer(c), g.growNow(c), g.wallNow(), g.perk('bumper:harvest_crop', 0), g.qlCeiling('farming'));
  }

  /** What a planter has in it, or that it is empty and grows at its rate in every season. */
  private planterLine(f: PlacedFurniture): string {
    const c = this.game.planted.get(f.id);
    return c ? this.cropLine(c) : `Empty: any seed. Growth speed ×${PLANTER_GROWTH}, every season.`;
  }

  /**
   * A planter's own jobs: what is in it, sowing it from the seeds you carry,
   * and tending, harvesting or pulling up what grows there -- the field's
   * jobs, aimed at the piece.
   */
  private planterEntries(f: PlacedFurniture): MenuItem[] {
    const g = this.game;
    const ft: Target = { kind: 'furniture', id: f.id };
    const entries: MenuItem[] = [{ label: this.planterLine(f), disabled: true }];
    const sow = ACTION_BY_ID.get('plant_seed');
    if (sow && !g.planted.has(f.id)) {
      const seeds = g.inventory.items.filter((it) => CROP_BY_SEED.has(it.id));
      entries.push({
        label: 'Sow',
        disabled: !seeds.length,
        hint: seeds.length ? undefined : 'No seeds carried (from foraging and botanizing).',
        children: seeds.length
          ? seeds.map((it) => {
              const crop = CROP_BY_SEED.get(it.id)!;
              const st: Target = { kind: 'furniture', id: f.id, itemUid: it.uid };
              const reason = sow.check?.(st, g) ?? null;
              return {
                label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it),
                // A stage in real time: the crop's, at the pace this sowing would grow at, at a planter's share of it.
                note: stageNote(crop.name, crop.stageSeconds * planterPace(g, f, crop.id), true, g.wallNow()),
                hint: reason ?? undefined,
                disabled: !!reason,
                onSelect: () => g.requestAction(sow, st),
              };
            })
          : undefined,
      });
    }
    for (const id of ['tend_crop', 'harvest_crop', 'clear_field']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(ft, g)) continue;
      const reason = def.check?.(ft, g) ?? null;
      entries.push({ label: def.labelFor?.(ft, g) ?? def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, ft) });
    }
    return entries;
  }

  /**
   * A grave: opened and emptied by whoever lies under it, and by nobody else.
   * Picking it up is listed for the one reason it is refused, which says so
   * plainly, as does every entry to somebody whose grave it is not.
   */
  private graveEntries(f: PlacedFurniture): MenuItem[] {
    const g = this.game;
    const ft: Target = { kind: 'furniture', id: f.id };
    const shut = graveSays(g, f, 'furniture_take_all');
    const entries: MenuItem[] = [{
      label: 'Open',
      note: shut ? undefined : `${graveUnits(f)} things`,
      hint: shut ?? undefined,
      disabled: !!shut,
      onSelect: () => this.cratePanel.openFurniture(f.id),
    }];
    for (const id of ['furniture_take_all', 'pick_up_furniture']) {
      const def = ACTION_BY_ID.get(id);
      if (!def) continue;
      const reason = graveSays(g, f, id) ?? def.check?.(ft, g) ?? null;
      entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, ft) });
    }
    return entries;
  }

  /** Every rare, supreme and fantastic thing in the pack, each to be given up at this altar. */
  private sacrificeEntry(f: PlacedFurniture): MenuItem {
    const g = this.game;
    const def = ACTION_BY_ID.get('sacrifice');
    const offered = sacrificeable(g);
    if (!def || !offered.length) return { label: 'Sacrifice', hint: SACRIFICE_SAID.pick, disabled: true };
    return {
      label: 'Sacrifice',
      note: FED_SAID,
      children: offered.map((it) => {
        const t: Target = { kind: 'furniture', id: f.id, itemUid: it.uid };
        const why = def.check?.(t, g) ?? null;
        return { label: itemName(it), note: it.count > 1 ? `one of ${it.count}` : undefined, hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(def, t) };
      }),
    };
  }

  /**
   * The settlement's sockets at one of its altars: what is in each, and every
   * bauble in the pack, to be set into the next empty socket of its tier or in
   * place of one already there.
   */
  private baubleEntry(f: PlacedFurniture): MenuItem {
    const g = this.game;
    const deed = g.deedOfMineAt(f.x, f.y);
    const setDef = ACTION_BY_ID.get('set_bauble');
    if (!deed || !setDef) return { label: 'Baubles', hint: BAUBLE_SAID.notOurs, disabled: true };
    const slots = BAUBLE_TIERS.reduce((n, t) => n + t.slots, 0);
    const sockets: MenuItem[] = BAUBLE_TIERS.map((t) => {
      const held = socketsOf(deed, t.id);
      return {
        label: `${t.name} sockets`,
        note: `${held.filter(Boolean).length} of ${t.slots}`,
        children: held.map((b, i) => ({ label: `${i + 1}. ${b ? socketText(b) : 'empty'}`, disabled: true })),
      };
    });
    const loose = g.inventory.items.filter((it) => it.id === TARNISHED || readBauble(it));
    const setting: MenuItem[] = loose.map((it) => {
      const b = readBauble(it);
      const next: Target = { kind: 'furniture', id: f.id, itemUid: it.uid };
      const why = setDef.check?.(next, g) ?? null;
      const tier = b ? BAUBLE_TIER_BY_ID.get(b.tier) : undefined;
      const over: MenuItem[] = tier
        ? socketsOf(deed, tier.id).flatMap((held, slot) => {
            if (!held) return [];
            const t: Target = { ...next, slot };
            const no = setDef.check?.(t, g) ?? null;
            return [{
              label: `In place of ${tier.name.toLowerCase()} ${slot + 1}: ${socketText(held)}`,
              hint: no ?? 'Current bauble is destroyed.',
              disabled: !!no,
              onSelect: () => g.requestAction(setDef, t),
            }];
          })
        : [];
      return {
        label: `Set ${itemName(it).toLowerCase()}`,
        hint: b ? undefined : why ?? undefined,
        disabled: !b,
        children: b
          ? [{ label: 'Next empty socket', hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(setDef, next) }, ...over]
          : undefined,
      };
    });
    return {
      label: 'Baubles',
      note: `${deed.baubles?.length ?? 0} of ${slots} sockets set`,
      children: [...sockets, ...setting],
    };
  }

  /** Opening, emptying and lifting a piece of furniture. */
  private furnitureEntries(f: PlacedFurniture): MenuItem[] {
    const g = this.game;
    const ft: Target = { kind: 'furniture', id: f.id };
    const def = furnitureDef(f.kind);
    const entries: MenuItem[] = [];
    // A planter is sown, tended and harvested like a field.
    if (def.planter) entries.push(...this.planterEntries(f));
    // The stone table: kneel at it, and spend what kneeling banks.
    if (def.altar) {
      const pray = ACTION_BY_ID.get('pray');
      entries.push({ label: `Favour ${Math.floor(g.player.favour)} of ${Math.floor(favourCap(g.skills.get(FAITH)))}`, disabled: true });
      if (pray) {
        const why = pray.check?.(ft, g) ?? null;
        entries.push({ label: 'Pray', hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(pray, ft) });
      }
      const cast = ACTION_BY_ID.get('cast');
      if (cast) {
        entries.push({
          label: 'Call on it',
          children: CASTS.map((c) => {
            const wantsItem = c.on === 'item';
            const targets = wantsItem ? g.inventory.items.filter((it) => canImprove(it.id) || it.dmg > 0) : [];
            // Called on where you stand: the call needs the altar's menu, not a walk to its corner tile (a big altar's far side was out of reach).
            const plain: Target = { kind: 'tile', x: g.player.tileX, y: g.player.tileY, cx: 0, cy: 0, spell: c.id };
            const why = cast.check?.(wantsItem ? { kind: 'item', uid: targets[0]?.uid ?? -1, spell: c.id } : plain, g) ?? null;
            return {
              label: c.name,
              note: `${c.cost} favour · ${skillName(FAITH).toLowerCase()} ${c.level}`,
              hint: why ?? c.note,
              disabled: !!why && !wantsItem,
              children: wantsItem
                ? targets.slice(0, 20).map((it) => {
                    const t: Target = { kind: 'item', uid: it.uid, spell: c.id };
                    const reason = cast.check?.(t, g) ?? null;
                    return {
                      label: itemName(it),
                      note: it.bless ? `already ${it.bless} of ${BLESS_CAP}` : it.dmg > 0 ? `damage ${it.dmg.toFixed(1)}` : undefined,
                      hint: reason ?? undefined,
                      disabled: !!reason,
                      onSelect: () => g.requestAction(cast, t),
                    };
                  })
                : undefined,
              onSelect: wantsItem ? undefined : () => g.requestAction(cast, plain),
            };
          }),
        });
      }
      entries.push(this.sacrificeEntry(f));
      entries.push(this.baubleEntry(f));
    }
    if (furnitureHolds(f)) {
      const heft = furnitureHeft(f);
      const note = heft ? `${furnitureKg(f).toFixed(0)} / ${heft} kg` : `${furnitureUnits(f)} / ${furnitureCapacity(f)} things`;
      entries.push({ label: 'Open', note, onSelect: () => this.cratePanel.openFurniture(f.id) });
    }
    if (def.stall && this.island) entries.push(...this.stallEntries(f));
    /*
     * A rack, and the crates standing on it.
     *
     * Reported as "no way to add crates to crate shelf", and there was not:
     * the rules have known about racks since the thing was built —
     * `place_crate` skips the ground rules on a deck and refuses anything but
     * a plank crate on the runners — but the only way to reach that action was
     * the *tile* menu, and a click on a tile with furniture on it never gets
     * that far. The same went for what was standing on it: a crate on a deck
     * is drawn by the rack rather than as an entity of its own, so there was
     * nothing to click.
     *
     * So the rack's own menu is where it is loaded and where what is on it is
     * reached. Spots fill in `rackDeck` order, which is the order the model
     * draws them in, so a rack three full looks three full.
     */
    if (rackSpots(f)) {
      const deck = rackDeck(f);
      const on = g.cratesOn(f);
      const free = deck.find(([sx, sy]) => !g.crateAt(f.x, f.y, sx, sy));
      entries.push({ label: this.rackLine(f), disabled: true });
      // Everything on it in one window, piled as the pack piles it (`rackStock`); the crates one by one below.
      if (on.length) entries.push({ label: 'Open all', note: `${on.length} crates`, onSelect: () => this.cratePanel.openRack(f.id) });
      const placeDef = ACTION_BY_ID.get('place_crate');
      const carried = g.inventory.items.filter((it) => crateKindOfItem(it.id));
      if (placeDef) {
        for (const it of carried) {
          const pt: Target = { kind: 'tile', x: f.x, y: f.y, cx: f.x, cy: f.y, sx: free?.[0] ?? 0, sy: free?.[1] ?? 0, itemUid: it.uid };
          const reason = free ? placeDef.check?.(pt, g) ?? null : 'All spots taken.';
          entries.push({
            label: `Put ${itemName(it).toLowerCase()} on it`,
            note: reason ? undefined : `spot ${on.length + 1} of ${rackSpots(f)}`,
            hint: reason ?? undefined,
            disabled: !!reason,
            onSelect: () => g.requestAction(placeDef, pt),
          });
        }
      }
      for (const c of on) {
        const ct: Target = { kind: 'crate', id: c.id };
        const children: MenuItem[] = [{ label: 'Open', onSelect: () => this.cratePanel.open(c.id) }];
        for (const id of ['crate_take_all', 'pick_up_crate']) {
          const d = ACTION_BY_ID.get(id);
          if (!d) continue;
          const reason = d.check?.(ct, g) ?? null;
          children.push({ label: d.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(d, ct) });
        }
        children.push(...this.nameEntry(ct));
        /*
         * Each by its spot, and by what is in it: its own name when it has one,
         * else the kinds it holds most of (`crateHolds`). Reported off a full
         * rack of eight rows all reading "Seeds": named alike, and the note
         * that told them apart was never drawn on a row that folds.
         */
        const holds = crateHolds(c);
        const room = `${crateUnits(c)} / ${crateCapacity(c)} things`;
        const spot = rackSpotOf(f, c);
        entries.push(c.name || !holds
          ? { label: `${spot} \u00b7 ${crateName(c)}`, note: holds ? `${holds} \u00b7 ${room}` : room, children }
          : { label: `${spot} \u00b7 ${holds}`, note: room, children });
      }
    }
    // An oven is fed and lit like a fire, and cooks like one.
    if (def.hearth) {
      const fuelDef = ACTION_BY_ID.get('fuel_oven');
      const wood = g.stockChoices((it) => isFuel(it.id));
      if (fuelDef && wood.length) entries.push({ label: 'Fuel', children: wood.map((s) => this.stackRow(fuelDef, ft, s)) });
      if (f.lit) entries.push({ label: 'Cook', children: this.cookEntries() });
    }
    // A barrel of water is where every brew starts.
    const brewDef = ACTION_BY_ID.get('start_brew');
    if (brewDef && brewDef.applies(ft, g) && !(f.ferment ?? 0)) {
      entries.push({
        label: 'Start a brew',
        children: BREWS.map((b) => {
          const bt: Target = { ...ft, brew: b.id } as Target;
          const reason = brewDef.check?.(bt, g) ?? null;
          return {
            label: b.name,
            note: `${b.count} × ${itemDef(b.input).name.toLowerCase()} · ${b.litres} litres · ${Math.round(b.time / 60)}m`,
            hint: reason ?? undefined,
            disabled: !!reason,
            onSelect: () => g.requestAction(brewDef, bt),
          };
        }),
      });
    }
    /*
     * Into the traces from the vehicle's own menu as well.
     *
     * Hitching was only ever on the beast's menu, and a beast standing at a
     * wagon is drawn under it, so every click on it found the wagon instead:
     * reported as four wildermon piled under a wagon with no way to put them
     * back in. Listed here are the ones the beast's own entry would put into
     * this vehicle's traces and no other, refused in the same words -- and the
     * ones in a crate you carry or stand beside, which come out of it straight
     * into a yoke, so a team is put together without each in turn having to
     * be the one that follows you.
     */
    const hitchDef = ACTION_BY_ID.get('hitch_creature');
    const rig = vehicleOf(f);
    if (hitchDef && rig && teamOf(f).length < rig.yokes) {
      const near = [...g.creatures.list.values()]
        .filter((c) => c.mine !== false && hitchDef.applies({ kind: 'creature', id: c.id }, g) && vehicleFor(g, c) === f)
        .sort((a, b) => Number(a.mode === 'stored') - Number(b.mode === 'stored') || a.name.localeCompare(b.name) || a.id - b.id);
      if (near.length) {
        entries.push({
          label: hitchDef.label,
          children: near.map((c) => {
            const ct: Target = { kind: 'creature', id: c.id };
            const reason = hitchDef.check?.(ct, g) ?? null;
            return { label: c.name, note: c.mode === 'stored' ? 'in a crate' : undefined, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(hitchDef, ct) };
          }),
        });
      }
    }
    // A lantern post: its lantern, its candle and its light.
    entries.push(...lampEntries(g, f));
    for (const id of ['light_oven', 'put_out_oven', 'take_ashes_oven', 'sleep', 'set_home', 'pull_cart', 'drop_cart', 'board_vehicle', 'board_passenger', 'leave_vehicle', 'leave_passenger', 'unhitch_team', 'examine_vessel', 'drink_from_vessel', 'empty_vessel', 'furniture_take_all', 'crate_follow', 'crate_work', 'scrub_moss', 'pick_up_furniture']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(ft, g)) continue;
      const reason = def.check?.(ft, g) ?? null;
      entries.push({ label: def.labelFor?.(ft, g) ?? def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, ft) });
    }
    return entries;
  }

  /** Fuelling, packing and unloading a kiln. */
  private kilnEntries(k: PlacedKiln): MenuItem[] {
    const g = this.game;
    const kt: Target = { kind: 'kiln', id: k.id };
    const entries: MenuItem[] = [];
    // Fuel and clay from the same stock a craft spends, stores within reach included.
    const fuelDef = ACTION_BY_ID.get('fuel_kiln');
    const fuel = g.stockChoices((it) => isFuel(it.id));
    if (fuelDef && fuel.length) entries.push({ label: 'Fuel', children: fuel.map((s) => this.stackRow(fuelDef, kt, s)) });
    const loadDef = ACTION_BY_ID.get('load_kiln');
    const green = g.stockChoices((it) => isGreenware(it.id));
    if (loadDef) {
      entries.push({
        label: 'Fire clay',
        disabled: !green.length,
        hint: green.length ? undefined : noneAtHand(g, 'no unfired clay'),
        children: green.length ? green.map((s) => this.stackRow(loadDef, kt, s)) : undefined,
      });
    }
    for (const id of ['light_kiln', 'damp_kiln', 'kiln_take_all', 'take_ashes_kiln', 'pick_up_kiln']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(kt, g)) continue;
      const reason = def.check?.(kt, g) ?? null;
      entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, kt) });
    }
    if (k.jobs.length) {
      const job = k.jobs[0];
      entries.push({ label: `In the kiln: ${itemDef(job.makes).name.toLowerCase()}`, note: `${Math.ceil(job.left)} s left, ${k.jobs.length} total`, disabled: true });
    }
    if (k.output.length) entries.push({ label: `Fired: ${k.output.map((o) => `${o.count > 1 ? `${o.count} × ` : ''}${itemName(o).toLowerCase()}`).join(', ')}`, disabled: true });
    return entries;
  }

  /** Beating a filled mould out on an anvil. */
  /** Setting a wildermon to a post, calling it off, and pulling the post up. */
  private postEntries(p: PlacedPost): MenuItem[] {
    const g = this.game;
    const pt: Target = { kind: 'post', id: p.id };
    const entries: MenuItem[] = [];
    const worker = p.worker !== null ? g.creatures.get(p.worker) : undefined;
    const reach = postRadius(p.ql);
    entries.push({ label: `QL ${p.ql.toFixed(0)} · reaches ${reach} tiles · ${postState(p, postKeep(this.game))}`, disabled: true });
    if (worker) {
      const def = SPECIES[worker.species];
      entries.push({ label: `${worker.name} works out of it`, note: def.gathers ? GATHER_VERB[def.gathers] : 'no task', disabled: true });
    } else {
      const assign = ACTION_BY_ID.get('assign_post');
      const candidates = postCandidates(g);
      if (assign) {
        entries.push({
          label: assign.label,
          disabled: !candidates.length,
          hint: candidates.length ? undefined : 'No wildermon following you or in a crate to hand.',
          children: candidates.length
            ? candidates.map((c) => {
                const ct: Target = { kind: 'post', id: p.id, creature: c.id };
                const reason = assign.check?.(ct, g) ?? null;
                const def = SPECIES[c.species];
                const job = def.gathers ? GATHER_DO[def.gathers].split(' and ')[0] : 'no task';
                return {
                  label: c.name,
                  note: c.mode === 'stored' ? `in a crate · ${job}` : job,
                  hint: reason ?? undefined,
                  disabled: !!reason,
                  onSelect: () => g.requestAction(assign, ct),
                };
              })
            : undefined,
        });
      }
    }
    for (const id of ['unassign_post', 'pick_up_post']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || !def.applies(pt, g)) continue;
      const reason = def.check?.(pt, g) ?? null;
      entries.push({ label: def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, pt) });
    }
    return entries;
  }

  /** Working on a bridge, or taking it down again. */
  private bridgeEntries(b: Bridge): MenuItem[] {
    const g = this.game;
    if (b.kind === 'aqueduct') return aqueductEntries(g, b);
    const bt: Target = { kind: 'bridge', id: b.id };
    const def = bridgeDef(b);
    const entries: MenuItem[] = [];
    const open = b.spans.find((s) => !isDone(s));
    entries.push({ label: `${b.spans.length} spans · ${def.carts ? 'carries a cart' : 'foot traffic only'}`, disabled: true });
    if (open) entries.push({ label: `Open span needs: ${spanWants(open)}`, disabled: true });
    if (isDrawbridge(b) && !open) entries.push({ label: capital(drawbridgeState(b)), disabled: true });
    for (const id of ['build_bridge', 'raise_drawbridge', 'lower_drawbridge', 'fit_lock', 'take_off_lock', 'scrub_moss', 'demolish_bridge']) {
      const a = ACTION_BY_ID.get(id);
      if (!a || !a.applies(bt, g)) continue;
      const reason = a.check?.(bt, g) ?? null;
      entries.push({ label: a.labelFor?.(bt, g) ?? a.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(a, bt) });
    }
    return entries;
  }

  /** Baiting a trap, taking what is in it, letting it go, and taking it up. */
  private trapEntries(t: PlacedTrap): MenuItem[] {
    const g = this.game;
    const tt: Target = { kind: 'trap', id: t.id };
    const entries: MenuItem[] = [];
    const def = trapDef(t);
    entries.push({
      label: def.water ? `QL ${t.ql.toFixed(0)} · holds ${creelHold(t)} fish` : `QL ${t.ql.toFixed(0)} · holds to taming ${trapHolds(t)} · reaches ${def.reach} tiles`,
      disabled: true,
    });
    const held = t.caught !== null ? g.creatures.get(t.caught) : undefined;
    if (held) {
      const s = SPECIES[held.species];
      entries.push({ label: `A ${s?.name.toLowerCase() ?? 'thing'} is held in it`, note: `taming ${tameNeeds(held).level} to handle`, disabled: true });
    }
    const bait = ACTION_BY_ID.get('bait_trap');
    if (bait && bait.applies(tt, g)) {
      const choices = baitInPack(g);
      const reason = bait.check?.(tt, g) ?? null;
      entries.push({
        label: t.bait ? `Change bait (${itemName(t.bait).toLowerCase()})` : 'Bait',
        disabled: !!reason,
        hint: reason ?? undefined,
        children: choices.length
          ? choices.slice(0, 12).map((it) => {
              const comers = Object.values(SPECIES).filter((sp) => isBaitFor(sp, it.id) && sp.tameLevel <= trapHolds(t));
              const fishy = BAIT_BY_ID.get(it.id);
              return {
                label: itemName(it),
                note: def.water
                  ? fishy ? fishy.favours.map((f) => itemDef(f).name.toLowerCase()).join(', ') : 'nothing comes to that'
                  : comers.length ? comers.map((sp) => sp.name).slice(0, 4).join(', ') : 'nothing this will hold',
                onSelect: () => {
                  // Put the chosen one at the front so the action picks it up.
                  const idx = g.inventory.items.indexOf(it);
                  if (idx > 0) g.inventory.items.splice(0, 0, ...g.inventory.items.splice(idx, 1));
                  g.requestAction(bait, tt);
                },
              };
            })
          : undefined,
      });
    }
    for (const id of ['empty_creel', 'take_catch', 'free_catch', 'pick_up_trap']) {
      const a = ACTION_BY_ID.get(id);
      if (!a || !a.applies(tt, g)) continue;
      const reason = a.check?.(tt, g) ?? null;
      entries.push({ label: a.labelFor?.(tt, g) ?? a.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(a, tt) });
    }
    return entries;
  }

  private anvilEntries(a: PlacedAnvil): MenuItem[] {
    const g = this.game;
    const at: Target = { kind: 'anvil', id: a.id };
    const entries: MenuItem[] = [];
    const smithDef = ACTION_BY_ID.get('smith');
    // Castings poured at the smelter, each named for the piece it is of, and
    // the metal for coins: from the pack, a bag, or a store within reach.
    const castings = g.stockChoices(isCasting, g.forgeReach());
    const lumps = g.stockChoices((it) => isMetalStock(it.id), g.forgeReach());
    // Pieces to a filling, and more of them for a Smith's Nail Maker.
    const per = (def: { makes: string; per?: number }): number => g.perk(`count:${def.makes}`, def.per ?? 1);
    if (smithDef) {
      entries.push({
        label: 'Smith',
        disabled: !castings.length,
        hint: castings.length ? undefined : 'Need a casting (pour a mould at the smelter).',
        children: castings.length
          ? castings.map((s) => {
              const c = s.item;
              const def = MOULD_BY_MAKES.get(c.piece as string);
              const t: Target = { ...at, itemUid: c.uid };
              const reason = smithDef.check?.(t, g) ?? null;
              const where = storedIn(s);
              return {
                label: `${itemName(c)} (${c.count})`,
                note: def ? `${per(def) > 1 ? `${per(def)} ` : 'a '}${itemDef(def.makes).name.toLowerCase()} · QL ${c.ql.toFixed(0)}${where ? ` · ${where}` : ''}` : where,
                hint: reason ?? undefined,
                disabled: !!reason,
                onSelect: () => g.requestAction(smithDef, t),
              };
            })
          : undefined,
      });
    }
    // Coins: a die in the pack, and a lump of gold named off the menu.
    const strikeDef = ACTION_BY_ID.get('strike_coins');
    const die = g.inventory.find('coin_die');
    const precious = lumps.filter((s) => COIN_METALS.includes(metalOfBar(s.item.id)?.id ?? ''));
    if (strikeDef) {
      entries.push({
        label: 'Strike coins',
        disabled: !die || !precious.length,
        hint: !die ? 'Need a coin die.' : !precious.length ? COIN_REFUSAL : undefined,
        note: die ? `${Math.ceil((100 - die.dmg) / DIE_WEAR)} strikes left in the die` : undefined,
        children:
          die && precious.length
            ? precious.map((s) => {
                const lump = s.item;
                const t: Target = { ...at, itemUid: lump.uid };
                const reason = strikeDef.check?.(t, g) ?? null;
                return { label: metalLabel(lump), note: storedIn(s), hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(strikeDef, t) };
              })
            : undefined,
      });
    }
    const up = ACTION_BY_ID.get('pick_up_anvil');
    if (up) entries.push({ label: up.label, onSelect: () => g.requestAction(up, at) });
    return entries;
  }

  /**
   * A settlement you were asked onto: what you are on it, and the way off it.
   *
   * It used to get the founder's menu -- its wildermon, an upgrade, a new
   * name, disbanding -- all of which the island refuses to anybody but the
   * founder, and nothing that would take you off the roll. Leaving was a line
   * at the foot of the People window's settlement page and nowhere else.
   * Asked for: "add a leave settlement option so citizens can quit
   * oceanport".
   */
  private citizenEntry(d: Deed): MenuItem {
    const holder = this.holderOf(d);
    return {
      label: `${d.name}${holder ? ` \u00b7 ${holder}\u2019s` : ''}`,
      children: [
        { label: standingWord(d), disabled: true },
        // Upgrading and renaming, for a rank its founder let do them (`settlement_refusal`).
        ...this.citizenDeedJobs(d),
        ...this.deliverEntry(),
        {
          label: `Leave ${d.name}`,
          note: 'Leave the settlement',
          hint: this.island ? undefined : 'Only on an island.',
          disabled: !this.island,
          onSelect: () => void this.leaveSettlement(d),
        },
      ],
    };
  }

  /** Upgrade and Rename on a settlement you are a citizen of, where your rank holds them. */
  private citizenDeedJobs(d: Deed): MenuItem[] {
    const g = this.game;
    const t: Target = { kind: 'tile', x: d.x, y: d.y, cx: d.x, cy: d.y };
    const out: MenuItem[] = [];
    const upgrade = DEED_ACTION_BY_ID.get('upgrade_deed');
    if (upgrade && !lacks(d, 'upgrade') && (d.level ?? 1) < MAX_DEED_LEVEL) {
      const reason = upgradeReason(g, d);
      out.push({
        label: `Upgrade to level ${(d.level ?? 1) + 1}`,
        hint: reason ?? undefined,
        disabled: !!reason,
        onSelect: () => g.requestAction(upgrade, t),
      });
    }
    const rename = ACTION_BY_ID.get('rename_deed');
    if (rename && !lacks(d, 'rename')) out.push({ label: rename.label, onSelect: () => g.requestAction(rename, t) });
    return out;
  }

  /** Who founded a settlement you belong to, as the island names them. */
  private holderOf(d: Deed): string | null {
    return this.game.neighbourDeeds.find((n) => n.x === d.x && n.y === d.y)?.holder ?? null;
  }

  /**
   * Ask to join a stranger's settlement, at its token (`rpc_join_ask`): its
   * founder and every rank holding Invite answer it in the Social window.
   */
  private askToJoinEntry(x: number, y: number): MenuItem[] {
    const g = this.game;
    const d = g.tokenAt(x, y);
    if (!d || g.isMyToken(x, y)) return [];
    const isle = this.island;
    const away = isle ? joinFromAfar(g, d) : 'Only on an island.';
    return [{
      label: `Ask to join ${d.name}`,
      note: away ? undefined : 'Its founder answers, or a rank with Invite',
      hint: away ?? undefined,
      disabled: !!away,
      onSelect: () => void isle?.askToJoinAt(x, y).then((why) => { if (why) g.logMsg(why, 'error'); }),
    }];
  }

  /** Off the roll of one you were asked onto, once you have said you mean it. */
  private async leaveSettlement(d: Deed): Promise<void> {
    const isle = this.island;
    if (!isle) return;
    if (!(await this.game.hooks.confirm(leaveQuestion(d, this.holderOf(d))))) return;
    // Said by the island when it is done, in the log: "You are no longer a
    // citizen of ...". Only a refusal is said here.
    const why = await isle.leaveDeedAt(d.x, d.y);
    if (why) this.game.logMsg(why, 'error');
  }

  /** The settlement menu: its wildermon, its upgrade, its name. */
  private deedEntry(): MenuItem {
    const g = this.game;
    const d = g.deed!;
    const level = g.deedLevel;
    // Yours only: the island shows a neighbour's settlement workers too (`mine` false).
    const kept = g.creatures.working();
    const children: MenuItem[] = [];
    const workers = g.creatures.workers().length;
    children.push({
      label: `Wildermon (${workers} of ${g.workerCap} working)`,
      disabled: !kept.length,
      hint: kept.length ? undefined : 'None working here.',
      children: kept.length ? kept.map((c) => ({ label: `${c.name} (${g.creatures.describe(c)})`, children: this.creatureEntries(c.id) })) : undefined,
    });
    const upgrade = DEED_ACTION_BY_ID.get('upgrade_deed');
    if (upgrade && level < MAX_DEED_LEVEL) {
      const reason = upgradeReason(g);
      const progress = upgradeProgress(g);
      const t: Target = { kind: 'tile', x: d.x, y: d.y, cx: d.x, cy: d.y };
      children.push({
        label: `Upgrade to level ${level + 1}`,
        note: `Border ${d.radius + 2} tiles, ${deedWorkersAt(level + 1)} workers`,
        hint: reason ?? undefined,
        disabled: !!reason,
        onSelect: () => g.requestAction(upgrade, t),
      });
      for (const r of progress) children.push({ label: `${r.met ? '✓' : '✗'} ${r.label}`, disabled: true });
    }
    // Standing orders for every worker on it, the island's (`rpc_deed_orders`), as the Settlement window's Workers tab sets them.
    const stance = this.deedPanel.ordersKnown();
    const ordersWhy = lacks(d, 'orders');
    children.push({
      label: stance ? `Orders: ${STANCE_NAMES[stance]}` : 'Orders',
      note: 'Every settlement worker, and every one assigned after',
      hint: ordersWhy ?? undefined,
      disabled: !!ordersWhy,
      children: ordersWhy ? undefined : ORDER_STANCES.map((st) => ({
        label: st === stance ? `${STANCE_NAMES[st]} (current)` : STANCE_NAMES[st],
        note: ORDER_HINTS[st],
        onSelect: () => this.deedPanel.setOrders(st),
      })),
    });
    children.push(...this.deliverEntry());
    for (const id of ['rename_deed', 'disband_deed']) {
      const def = ACTION_BY_ID.get(id);
      if (!def) continue;
      const t: Target = { kind: 'tile', x: d.x, y: d.y, cx: d.x, cy: d.y };
      children.push({ label: def.label, onSelect: () => g.requestAction(def, t) });
    }
    return { label: `${d.name} · level ${level}`, children };
  }

  /**
   * Notices and work, from the settlement's own menu: the Settlement window
   * opened at its Notices or its Work tab, where a citizen delivers at the
   * token. Only on an island, which is the only place either is.
   */
  private deliverEntry(): MenuItem[] {
    if (!this.island) return [];
    return [
      { label: 'Deliver work', note: `At the totem, within ${DELIVER_REACH} tiles`, onSelect: () => this.deedPanel.open('work') },
      { label: 'Notices', onSelect: () => this.deedPanel.open('notices') },
    ];
  }

  /** Actions for a wildermon: taming and feeding, or for a tamed one its stance, job and home. */
  private creatureEntries(id: number): MenuItem[] {
    const g = this.game;
    const c = g.creatures.get(id);
    if (!c) return [];
    const target: Target = { kind: 'creature', id };
    const entries: MenuItem[] = [];
    const item = (actionId: string, t: Target = target, label?: string): MenuItem | null => {
      const def = CREATURE_ACTION_BY_ID.get(actionId) ?? CREATURE_CRATE_ACTION_BY_ID.get(actionId) ?? ACTION_BY_ID.get(actionId);
      if (!def || !def.applies(t, g)) return null;
      const reason = def.check?.(t, g) ?? null;
      return { label: label ?? def.labelFor?.(t, g) ?? def.label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, t) };
    };
    const push = (m: MenuItem | null): void => {
      if (m) entries.push(m);
    };
    push(item('examine_creature'));
    push(item('tame', target, `Tame (uses ${baitHint(c)})`));
    // One in a crate is let out by opening the crate it is in, standing or carried.
    if (c.mode === 'stored') {
      const h = crateOf(g, c.id);
      const at: Target | null = h && 'piece' in h ? { kind: 'furniture', id: h.piece.id }
        : h?.carried ? { kind: 'item', uid: h.item.uid } : null;
      if (at) {
        push(item('crate_follow', at));
        push(item('crate_work', at));
      }
    }
    // Your companion, set on a wild one from its own menu (`order_attack`).
    const pet = c.mode === 'wild' ? g.companion() : null;
    if (pet) push(item('order_attack', { kind: 'creature', id: pet.id, foe: c.id }, `Set ${pet.name} on it`));
    if (c.mode === 'active') {
      // Orders in a fight, heard from wherever you stand.
      const foe = g.fightTarget ?? g.marked ?? g.nearestHostile()?.id;
      push(item('order_attack', foe === undefined || foe === null ? target : { ...target, foe }));
      push(item('order_heel'));
      entries.push({
        label: `Stance: ${STANCE_NAMES[c.stance]}`,
        children: COMPANION_STANCES.map((s) => ({
          label: s === c.stance ? `${STANCE_NAMES[s]} (current)` : STANCE_NAMES[s],
          note: STANCE_HINTS[s],
          onSelect: () => {
            const def = CREATURE_ACTION_BY_ID.get('set_stance');
            if (def) g.requestAction(def, { ...target, stance: s });
          },
        })),
      });
    }
    if (c.mode === 'active' || c.mode === 'deed') {
      const def = SPECIES[c.species];
      const food = g.inventory.items.filter((it) => feedable(def, it.id));
      if (food.length) {
        entries.push({
          label: 'Feed',
          children: food.map((it) => ({ label: it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it), onSelect: () => g.requestAction(CREATURE_ACTION_BY_ID.get('feed') as ActionDef, { ...target, itemUid: it.uid }) })),
        });
      } else push(item('feed'));
    }
    if ((SPECIES[c.species].pannier ?? 0) > 0 && c.mode !== 'wild' && c.mode !== 'stored') {
      entries.push({ label: 'Open panniers', onSelect: () => this.cratePanel.openPannier(c.id) });
    }
    /*
     * Brushing, pairing and looking one over: the husbandry, which the rules
     * have had on both sides since blood came in and this menu never offered.
     * A Herdsman with Choose the Sex says which the young one is to be.
     */
    push(item('groom'));
    const pairing = item('pair_creature');
    const pairDef = ACTION_BY_ID.get('pair_creature');
    if (pairing && !pairing.disabled && pairDef && g.perk('breed:sex', 0) > 0) {
      entries.push({
        label: pairing.label,
        children: (['female', 'male'] as const).map((sex) => ({ label: `For a ${sex} young`, onSelect: () => g.requestAction(pairDef, { ...target, sex }) })),
      });
    } else push(pairing);
    push(item('read_blood'));
    // Its gear, a slot at a time: fitted from the pack at its size, and taken off (`wildgearActions.ts`).
    for (const slot of GEAR_SLOTS) {
      push(item(fitGearId(slot)));
      push(item(removeGearId(slot)));
    }
    // An ancient comb, file, lamp or pot out of the ground, offered only while you carry one (`ARTIFACT_FOR`).
    for (const id of Object.keys(ARTIFACT_FOR)) push(item(id));
    push(item('shear'));
    push(item('milk_creature'));
    push(item('tack_creature'));
    push(item('mount_creature'));
    push(item('dismount_creature'));
    push(item('untack_creature'));
    push(item('hitch_creature'));
    push(item('unhitch_creature'));
    // A species with more than one trade is set to one of them by name, and
    // which is your say. None has more than one at the moment; the door stays.
    {
      const def = CREATURE_ACTION_BY_ID.get('assign_deed');
      const trades = SPECIES[c.species]?.trades;
      if (def && trades && trades.length > 1 && def.applies(target, g)) {
        entries.push({
          label: def.label,
          children: trades.map((trade) => {
            const tt: Target = { ...target, job: trade };
            const why = def.check?.(tt, g) ?? null;
            const does = GATHER_DO[trade];
            return { label: does.charAt(0).toUpperCase() + does.slice(1), hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(def, tt) };
          }),
        });
      } else {
        push(item('assign_deed'));
      }
    }
    push(item('take_creature'));
    push(item('crate_creature'));
    push(item('rename_creature'));
    push(item('release_creature'));
    push(item('cull_creature'));
    push(item('attack_creature'));
    // Its kind's page, wherever a creature's actions are listed: the menu, the
    // Tile window and the card of one of your own. Last, so the number keys
    // the Tile window hands out are the ones they always were.
    entries.push({ label: 'Field guide', note: `${SPECIES[c.species]?.name ?? 'Kind'} page`, onSelect: () => this.guide.openAt(c.species) });
    return entries;
  }

  /** "Give it a name", for anything that will take one. */
  /**
   * Founding a settlement, on the ground rather than in a pocket.
   *
   * The action hangs off the stake, so the only way to it was to open the
   * inventory and right-click the thing — which on a phone, with no right
   * button and a window to go and find, is a way of hiding it. Reported as
   * "cant place a deed despite having a stake".
   *
   * On the tile you are standing on, because that is where the token goes: the
   * island founds it at your feet whatever you clicked, and an entry on some
   * other tile would be an offer it was not going to keep.
   */
  private settlementEntry(pick: Pick): MenuItem[] {
    const g = this.game;
    const stake = g.inventory.items.find((it) => it.id === 'deed_stake');
    const def = ACTION_BY_ID.get('found_settlement');
    if (!stake || !def) return [];
    /*
     * Offered wherever you pick, rather than only underfoot.
     *
     * It used to return nothing at all unless the tile you clicked was the one
     * you were standing on — right about where the token goes, and useless on
     * a phone, where that tile is underneath your own body and a thumb cannot
     * reach it. There was no entry, greyed or otherwise, and nothing to say
     * why. The action walks you there first now.
     */
    const t: Target = { kind: 'tile', x: pick.x, y: pick.y, cx: pick.x, cy: pick.y };
    const here = pick.x === g.player.tileX && pick.y === g.player.tileY;
    const reason = def.check?.(t, g) ?? null;
    return [{
      label: 'Found a settlement here',
      note: reason ? undefined : here ? 'Places the totem here' : 'Walks there, then places the totem',
      hint: reason ?? undefined,
      disabled: !!reason,
      // The name is asked for by `requestAction`, which every other way of
      // starting this action also goes through — this entry used to be the
      // only one that knew to ask, which is how the island came to be handed a
      // settlement with no name on it and called it Homestead.
      onSelect: () => g.requestAction(def, t),
    }];
  }

  /**
   * What you can do to a person, which until now was nothing at all.
   *
   * Everything else on this canvas is picked and then acted on through the
   * game: a tile, a creature, a crate. A person is not in the game — the
   * roster is a name and a pose and nothing the simulation reads — so these go
   * straight to the island, which is the only thing that knows who they are.
   *
   * Written in the second person like every other menu here, and each one says
   * what it would do rather than what it is called: *ask Ivar to live at
   * Ravenhold* is the whole sentence, and it is the label.
   */
  private personMenu(uid: string): { title: string; facts?: string[]; entries: MenuItem[] } {
    const who = this.game.roster.list().find((p) => p.uid === uid);
    const name = who?.name ?? 'Somebody';
    const isle = this.island;
    if (!isle) {
      return { title: name, entries: [{ label: 'Nothing to be done', disabled: true, hint: 'Island only.', onSelect: () => {} }] };
    }
    const said = (what: Promise<string | null>): void => {
      void what.then((why) => {
        if (why) this.game.logMsg(why, 'error');
      });
    };
    const entries: MenuItem[] = [];
    /*
     * First, because it is the only one of these that is about being in the
     * same place as somebody, and being in the same place is what the rest of
     * them are usually for. It is also the only one this machine answers by
     * itself — everything below goes to the island.
     */
    const after = this.game.following(uid);
    entries.push({
      label: after ? `Stop following ${name}` : `Follow ${name}`,
      note: after ? 'Following' : 'Follow until you walk elsewhere',
      onSelect: () => this.game.follow(uid, name),
    });
    // Their wounds, at your first aid and out of your pack: anybody may.
    const dress = ACTION_BY_ID.get('bind_wound');
    const patient: Target = { kind: 'person', uid, name };
    if (dress?.applies(patient, this.game)) {
      const why = dress.check?.(patient, this.game) ?? null;
      entries.push({
        label: dress.labelFor?.(patient, this.game) ?? dress.label,
        note: 'Your first aid and dressings',
        hint: why ?? undefined,
        disabled: !!why,
        onSelect: () => this.game.requestAction(dress, patient),
      });
    }
    /*
     * Asking them onto a settlement of yours. Whatever they already belong to
     * is no bar short of the cap, so this is offered beside anybody, and
     * greyed with the island's own reason (`inviteRefusal`) when the Social
     * window's answer is recent enough to know one; otherwise the island
     * says. One entry for each settlement whose founder you are or whose
     * rank of yours holds Invite; with none, the settlement you are handed,
     * greyed with your rank's refusal.
     */
    const deed = this.game.deed;
    this.social.prime();
    const known = this.social.known();
    const places = known ? inviteDeeds(known) : [];
    for (const d of places) {
      const why = inviteRefusal(known!, uid, name, d.founder);
      entries.push({
        label: `Invite ${name} to ${d.name}`,
        note: why ? undefined : `Joins as: ${defsOf(d).find((r) => r.newcomer)?.name ?? 'newcomer rank'}`,
        hint: why ?? undefined,
        disabled: !!why,
        onSelect: () => said(isle.invite(uid, d.founder)),
      });
    }
    if (!places.length && deed) {
      const why = lacks(deed, 'invite');
      entries.push({
        label: `Invite ${name} to ${deed.name}`,
        note: why ? undefined : 'Joins as: newcomer rank',
        hint: why ?? undefined,
        disabled: !!why,
        onSelect: () => said(isle.inviteAt(uid, deed.x, deed.y)),
      });
    }
    /*
     * A trade: both standing within reach of each other, which the island
     * holds to; greyed here only when the roster already says they are too
     * far off.
     */
    const apart = who ? Math.max(Math.abs(who.x - this.game.player.x), Math.abs(who.y - this.game.player.y)) : 0;
    const far = apart > BARTER_REACH ? BARTER_SAID.far : null;
    entries.push({
      label: `Barter with ${name}`,
      note: far ? undefined : 'Both add items and silver; exchanged when both accept',
      hint: far ?? undefined,
      disabled: !!far,
      onSelect: () => void this.barter.ask(uid),
    });
    entries.push({
      label: `Ask ${name} to be a friend`,
      note: 'Shows each other on the map',
      onSelect: () => said(isle.befriend(uid)),
    });
    entries.push({
      label: `Write to ${name}`,
      note: 'Delivered to their letters',
      onSelect: () => this.social.openOn(uid, 'letters'),
    });
    entries.push({ label: 'Everybody…', onSelect: () => this.social.openOn(uid, 'friends') });
    // To the island's keepers, who see it in the Island keeper window; the one reported is not told.
    entries.push({
      label: `Report ${name}`,
      note: `To the island's keepers; ${REPORTS_A_DAY} a day`,
      children: REPORT_REASONS.map((r) => ({
        label: r.label,
        onSelect: () => void (async () => {
          const ask = this.game.hooks.note ?? ((q: string) => this.game.hooks.prompt(q, ''));
          const note = await ask(`Report ${name}: ${r.label}. Note, optional, up to ${REPORT_NOTE_MAX} characters:`, REPORT_NOTE_MAX);
          if (note === null) return;
          const why = await isle.report(uid, r.id, note);
          this.game.logMsg(why ?? `Reported ${name}: ${r.label}.`, why ? 'error' : 'event');
        })(),
      })),
    });
    return {
      title: name,
      facts: [who ? `${name}: at ${Math.floor(who.x)}, ${Math.floor(who.y)}.` : `${name}: on this island.`],
      entries,
    };
  }

  private nameEntry(t: Target): MenuItem[] {
    const def = ACTION_BY_ID.get('name_thing');
    if (!def || !def.applies(t, this.game)) return [];
    return [{ label: def.labelFor?.(t, this.game) ?? def.label, onSelect: () => this.game.requestAction(def, t) }];
  }

  /** What the tile menu can do at a shop counter: the store window, and on an island buying, the till and the prices. */
  private counterWays(): CounterWays {
    const isle = this.island;
    return {
      open: (id) => this.cratePanel.openCounter(id),
      ...(isle ? {
        buy: (it: Item) => void this.buyOffCounter(it),
        takings: (id: number) => void (async () => {
          const why = await isle.atCounter('takings', id);
          if (why) this.game.logMsg(why, 'error');
        })(),
        prices: () => this.market.openStall(),
      } : {}),
    };
  }

  /**
   * A market stall's own entries. Reported: "Market stalls on a deed can't be accessed by non-members to buy wares. No
   * way to set prices or buy items." Its keeper: the Market window's Stall tab, where its goods are priced. Anybody
   * else: each priced thing on it, bought at its price (`rpc_buy`), deed or no deed.
   */
  private stallEntries(f: PlacedFurniture): MenuItem[] {
    if (f.mine !== false) return [{ label: 'Set prices', note: 'Market window, Stall tab', onSelect: () => this.market.openStall() }];
    const p = this.game.player;
    if (Math.max(Math.abs(f.x + 0.5 - p.x), Math.abs(f.y + 0.5 - p.y)) > COUNTER_SEEN) return [{ label: 'Buy', hint: COUNTER_TOO_FAR_TO_SEE, disabled: true }];
    const priced = f.items.filter((it) => it.price !== undefined);
    if (!priced.length) return [{ label: 'Buy', hint: f.items.length ? 'No prices set.' : 'Empty.', disabled: true }];
    return [{
      label: 'Buy',
      children: priced.map((it) => {
        const why = stallBuyRefusal(this.game, f, it);
        return {
          label: `${itemName(it)}${it.count > 1 ? ` (${it.count})` : ''} — ${priceWords(it.price ?? 0)}`,
          hint: why ?? undefined, disabled: !!why, onSelect: () => void this.buyOffCounter(it),
        };
      }),
    }];
  }

  /** Buy one thing off somebody's counter on the island, and say what came of it. */
  private async buyOffCounter(it: Item): Promise<void> {
    if (!this.island || it.price === undefined) return;
    const price = it.price;
    const why = await this.island.atCounter('buy', it.uid);
    this.game.logMsg(why ?? boughtLine(it.count, itemName(it), price), why ? 'error' : 'event');
  }

  /**
   * Planning and construction entries for a tile: footprint, walls on the nearest side, floors, storeys. On the storey
   * being worked, or pinned (`Game.storeyFor`); `storey` is the storey a pinned storey's own menu is for (`storeyMenu`),
   * which has that storey's work and nothing of the ground's.
   */
  private buildingEntries(pick: Pick, storey?: number): MenuItem[] {
    /** What a tile going on piers adds to an entry: to its label, and a note of the deck and the drop. */
    type PierNote = { on: string; note?: string };
    const g = this.game;
    const bld = g.buildings;
    const { x, y } = pick;
    const entries: MenuItem[] = [];
    const act = (id: string): ActionDef => {
      const def = BUILD_ACTION_BY_ID.get(id);
      if (!def) throw new Error(`unknown building action ${id}`);
      return def;
    };
    const base: Extract<Target, { kind: 'tile' }> = { kind: 'tile', x, y, cx: pick.cx, cy: pick.cy };
    // Each barred the way the game will bar it: from down in a cellar first, where nothing up top is worked on (`cellarReason`).
    const item = (def: ActionDef, target: Target, label = def.label): MenuItem => {
      const reason = cellarReason(g, def, target);
      return { label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, target) };
    };
    // Building a planned piece, a number of goes at a time (`buildCounts.ts`).
    const build = (def: ActionDef, target: Target, label: string, bill: Bill): MenuItem => buildRow(g, def, target, label, bill, cellarReason(g, def, target));
    // A Mason's Repoint: a finished wall of stone laid again in another stone, one entry to each.
    const repoint = (standing: { material: string; type: Parameters<typeof layingBill>[1] }, target: Extract<Target, { kind: 'tile' }>, label: string): MenuItem[] => {
      const def = act('repoint_wall');
      if (!def.applies(target, g)) return [];
      return [{
        label,
        children: MATERIALS.filter((m) => m.kind === 'stone' && m.id !== standing.material && takesAs(m, { wall: standing.type })).map((m) => {
          const to: Extract<Target, { kind: 'tile' }> = { ...target, material: m.id };
          const why = cellarReason(g, def, to);
          return {
            label: m.name,
            note: describeNeeds(layingBill(m.id, standing.type), materialName),
            hint: why ?? undefined,
            disabled: !!why,
            onSelect: () => g.requestAction(def, to),
          };
        }),
      }];
    };
    // Stone that has greened over, cleared a side at a time: every storey of the wall on that border.
    const ivy = (target: Extract<Target, { kind: 'tile' }>): MenuItem[] => {
      const def = ACTION_BY_ID.get('clear_ivy');
      if (!def || !def.applies(target, g)) return [];
      return [item(def, target, def.labelFor?.(target, g) ?? def.label)];
    };
    const b = bld.buildingAt(x, y);
    if (!b) {
      // Out past a building: the jetty that goes there, or is there (`frameMenu.ts`).
      entries.push(...frameJettyEntries(g, pick, (base, level, material, side, hand) => this.startPlacingStairs(base, level, material, 'stairs', side, false, hand), storey));
      // Up on a pinned storey, nothing else: what follows is the ground's.
      if (storey !== undefined) return entries;
      // No building here: a fence or a half wall still goes on any border,
      // and the border is decided by which edge of the tile was clicked.
      const side = nearestSide(x, y, pick.wx, pick.wy);
      const withSide: Extract<Target, { kind: 'tile' }> = { ...base, side };
      const standing = bld.wall(0, x, y, side);
      if (standing) {
        const what = WALL_TYPE_BY_ID.get(bld.seenType(standing))?.name ?? 'Fence';
        entries.push(...gateEntries(this.game, withSide));
        if (!isDone(standing)) entries.push(build(act('build_wall'), withSide, `Build ${what.toLowerCase()} (${SIDE_NAMES[side]}) · needs ${describeNeeds(standing, materialName)}`, standing));
        entries.push(item(act('remove_wall'), withSide, `Remove ${what.toLowerCase()} (${SIDE_NAMES[side]})`));
        entries.push(...repoint(standing, withSide, `Repoint ${what.toLowerCase()} (${SIDE_NAMES[side]})`));
        entries.push(...ivy(withSide));
      } else {
        const fence = act('plan_fence');
        const probe = cellarReason(g, fence, { ...withSide, wallType: 'fence', material: 'log' });
        if (probe) entries.push({ label: `Plan fence (${SIDE_NAMES[side]})`, hint: probe, disabled: true });
        else {
          entries.push({
            label: `Plan fence (${SIDE_NAMES[side]})`,
            children: FENCE_TYPES.map((wt) => ({
              label: wt.name,
              children: MATERIALS.filter((m) => takesAs(m, { wall: wt.id })).map((m) => ({
                label: m.name,
                note: describeNeeds(wallBill(m.id, wt.id), materialName),
                onSelect: () => g.requestAction(fence, { ...withSide, wallType: wt.id, material: m.id }),
              })),
            })),
          });
        }
      }
      if (!g.onDeed(x, y)) return entries;
      const nb = bld.neighbourBuilding(x, y);
      // Where the ground is not level with the floor the tile would stand on piers: the deck it would stand under, and the drop (`piers.ts`).
      const onPiers = (into?: Building): PierNote => {
        const site = g.foundationAt(x, y) ? null : g.pierSite(x, y, into);
        return site?.deck == null ? { on: '' } : { on: ' on piers', note: `deck at ${metres(site.deck)} m, ${metres(pierDrop(site.ground, site.deck))} m drop` };
      };
      if (nb) {
        const p = onPiers(nb);
        entries.push({ ...item(act('add_to_building'), base, `Add to ${nb.name}${p.on}`), note: p.note });
      }
      const p = onPiers();
      entries.push({ ...item(act('plan_building'), base, `${act('plan_building').label}${p.on}`), note: p.note });
      // A footprint dragged out over a rectangle from this tile, laid out before it is asked for (`planarea.ts`).
      if (nb && nb.levels === 1) entries.push({ label: `Add an area to ${nb.name}`, note: 'cursor: far corner · click to plan', onSelect: () => this.startPlanArea({ kind: 'footprint', buildingId: nb.id, level: 0, anchor: { x, y } }) });
      else if (!nb) entries.push({ label: 'Plan building over an area', note: 'cursor: far corner · click to plan', onSelect: () => this.startPlanArea({ kind: 'footprint', level: 0, anchor: { x, y } }) });
      entries.push(...this.undoRows());
      return entries;
    }
    const pinned = g.pinnedStorey();
    // A pinned storey's own menu, on its roof's level: the roof, its railing and a storey more, and nothing else.
    if (storey !== undefined && storey >= b.levels) {
      base.level = b.levels - 1;
      entries.push(...roofEntries(g, b, base, act, item, build, (plan) => this.startPlanArea(plan)));
      entries.push(...frameRoofEntries(g, pick, b));
      entries.push(item(act('add_floor'), base));
      entries.push(...this.undoRows());
      entries.push(item(act('rename_building'), base));
      return entries;
    }
    const level = storey ?? g.storeyFor(b);
    // Every storey job asked from here names the storey it was shown for (`jobLevel`), which is how the island knows it.
    base.level = level;
    const side = nearestSide(x, y, pick.wx, pick.wy);
    const sideName = SIDE_NAMES[side];
    const withSide: Extract<Target, { kind: 'tile' }> = { ...base, side };
    // How near a building roofed in glass is to being a glasshouse (`glasshouse.ts`).
    if (glazing(bld, b)) {
      entries.push({
        label: isGlasshouse(bld, b)
          ? `Glasshouse: tilled ground, crop growth speed ×${GLASSHOUSE_GROWTH}, every season`
          : b.levels !== 1
            ? `Glass roof over ${b.levels} storeys: glasshouse must be 1 storey`
            : glassDone(bld, b) < b.tiles.length
              ? `Finished glass: ${glassDone(bld, b)}/${b.tiles.length} tiles (glasshouse at ${b.tiles.length})`
              : 'Not a glasshouse: needs full-height walls all round',
        disabled: true,
      });
    }
    // Pinned on a storey, the storey control says which.
    if (b.levels > 1 && pinned === null) {
      entries.push({
        label: `Work on storey ${level + 1}`,
        children: Array.from({ length: b.levels }, (_, i) => ({
          label: i === level ? `Storey ${i + 1} (current)` : `Storey ${i + 1}`,
          onSelect: () => {
            bld.chooseWorkLevel(b, i);
          },
        })),
      });
    }
    const wall = bld.wall(level, x, y, side);
    // A portcullis stands on the ground floor, whichever storey is being worked on; not in an upper storey's own menu.
    if (storey === undefined) entries.push(...gateEntries(this.game, withSide));
    if (wall) {
      if (!isDone(wall)) entries.push(build(act('build_wall'), withSide, `Build wall (${sideName}) · needs ${describeNeeds(wall, materialName)}`, wall));
      entries.push(item(act('remove_wall'), withSide, `Remove wall (${sideName})`));
      entries.push(...repoint(wall, withSide, `Repoint wall (${sideName})`));
    } else {
      const plan = act('plan_wall');
      const probe = cellarReason(g, plan, { ...withSide, wallType: 'solid', material: 'log' });
      if (probe) entries.push({ label: `Plan wall (${sideName})`, hint: probe, disabled: true });
      else {
        entries.push({
          label: `Plan wall (${sideName})`,
          // A railing only off the ground: up a storey, or on a deck on piers (`frame.ts`).
          children: WALL_TYPES.filter((wt) => wt.id !== 'railing' || level > 0 || bld.onPiers(x, y)).map((wt) => {
            // A hidden door is planned as a solid wall, the door asked for with the plan itself, with its iron in
            // hand; and a portcullis only on the ground floor (`gates.ts`): said on the type, before a material.
            const hidden = wt.id === 'hidden_door';
            const lacks = hidden ? hiddenDoorWants(g)
              : wt.ground && level > 0 ? gatePlanRefusal(wt.id, MATERIALS.find((m) => fitsMaterial(wt.id, m)), level, !bld.buildingAt(x, y)) : null;
            return {
              label: wt.name,
              hint: lacks ?? undefined,
              disabled: !!lacks,
              // A portcullis is laid only in stone or brick (`gates.ts`).
              children: MATERIALS.filter((m) => fitsMaterial(wt.id, m) && takesAs(m, { wall: wt.id })).map((m) => ({
                label: m.name,
                note: describeNeeds(wallBill(m.id, wt.id), materialName)
                  + (hidden ? `, and ${hiddenDoorIronWords()} as it is planned` : ''),
                onSelect: () => (hidden
                  ? planHiddenDoor(g, plan, { ...withSide, material: m.id })
                  : g.requestAction(plan, { ...withSide, wallType: wt.id, material: m.id })),
              })),
            };
          }),
        });
      }
      // No plan: a bare outside side of storey 2 and up, drawn with no plan model; or the mark taken off (`noPlanReason`).
      const [ox, oy] = side === 'n' ? [x, y - 1] : side === 's' ? [x, y + 1] : side === 'w' ? [x - 1, y] : [x + 1, y];
      if (level >= NO_PLAN_FROM && bld.buildingAt(ox, oy)?.id !== b.id) {
        entries.push(bld.noPlan(level, borderOf(x, y, side))
          ? item(act('mark_out'), withSide, `Mark out (${sideName})`)
          : item(act('no_plan'), withSide, `No plan (${sideName})`));
      }
    }
    // Every storey's wall on this side, whichever storey is being worked on.
    entries.push(...ivy(withSide));
    // Every bare outside side of the storey at once, laid out before it is asked for (`planarea.ts`).
    entries.push(...this.areaWallRows(b, level, x, y));
    // Columns on its corners, and the railing round a flat roof (`frameMenu.ts`).
    entries.push(...frameFootprintEntries(g, pick, b, level));
    const floor = bld.floor(level, x, y);
    const plan = act('plan_floor');
    // A flight or a ladder down to the cellar is the ground floor's, and has entries of its own (`cellarEntries`).
    const flightDown = level === 0 && !!floor && (floorKind(floor) === 'stairs' || floorKind(floor) === 'ladder');
    // The ground floor of a tile on piers is its deck, and the piers under it go on its bill (`piers.ts`).
    const deck = level === 0 && bld.onPiers(x, y);
    if (flightDown) {
      // Below.
    } else if (floor) {
      const what = deck ? 'deck' : floorKind(floor) === 'floor' && level === 0 ? 'flooring' : floorName(floor);
      if (!isDone(floor)) entries.push(build(act('build_floor'), base, `Build ${what} · needs ${describeNeeds(floor, materialName)}`, floor));
      entries.push(item(act('remove_floor'), base, `Remove ${what}`));
    } else {
      const floorLabel = deck ? 'deck' : level > 0 ? 'floor' : 'flooring';
      /*
       * Asked first with the heaviest material, which nothing standing is too
       * heavy for: whatever refuses it refuses every material. A deck lighter
       * than the walls it would carry (`deckBears`) is refused material by
       * material below, each in its own words, so a building of stone is
       * offered its stone decks and shown why not the rest.
       */
      const heaviest = MATERIALS.reduce((a, m) => (m.heft > a.heft ? m : a));
      const probe = cellarReason(g, plan, { ...base, material: heaviest.id });
      if (probe) entries.push({ label: `Plan ${floorLabel}`, hint: probe, disabled: true });
      else {
        entries.push({
          label: `Plan ${floorLabel}`,
          children: MATERIALS.filter((m) => takesAs(m, { floor: 'floor' })).map((m) => {
            const t: Target = { ...base, material: m.id, floorKind: 'floor' };
            const why = cellarReason(g, plan, t);
            if (why) return { label: m.name, hint: why, disabled: true };
            const bill = describeNeeds(deck ? deckBill(m.id, g.pierDropAt(x, y)) : floorBill(m.id), materialName);
            // A deck carries what it is laid in (`deckCarries`), and says so.
            return { label: m.name, note: deck ? `${bill} · walls up to ${heftWord(m.heft)}` : bill, onSelect: () => g.requestAction(plan, t) };
          }),
        });
        if (level > 0) {
          const stairs = cellarReason(g, plan, { ...withSide, material: 'log', floorKind: 'stairs' });
          if (stairs) {
            entries.push({ label: `Plan staircase (up from the ${sideName})`, hint: stairs, disabled: true });
            entries.push({ label: `Plan ${SINGLE_STAIRS_NAME} (up from the ${sideName})`, hint: stairs, disabled: true });
          } else {
            // The side to climb from is chosen on the tile: Q and E turn it, a click plans it.
            entries.push({
              label: 'Plan staircase',
              children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
                label: m.name,
                note: `${describeNeeds(floorBill(m.id, 'stairs'), materialName)} · Q/E: side`,
                onSelect: () => this.startPlacingStairs(base, level, m.id, 'stairs', side),
              })),
            });
            // Half the tile wide, up the half on the left or the right as you climb: Q and E take it round the tile.
            entries.push({
              label: `Plan ${SINGLE_STAIRS_NAME}`,
              children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
                label: m.name,
                note: `${describeNeeds(floorBill(m.id, 'stairs', undefined, 'l'), materialName)} · ${SINGLE_TURNS}`,
                onSelect: () => this.startPlacingStairs(base, level, m.id, 'stairs', side, false, 'l'),
              })),
            });
            entries.push({
              label: 'Plan ladder',
              note: `${describeNeeds(floorBill('plank', 'ladder'), materialName)} · Q/E: side`,
              onSelect: () => this.startPlacingStairs(base, level, 'plank', 'ladder', side),
            });
          }
          // Round a post in the middle of the tile, on and off across any side: no side to choose.
          entries.push(...spiralRow(g, base, `Plan ${SPIRAL_STAIRS_NAME}`, (material) => this.startPlacingStairs(base, level, material, 'stairs', side, false, SPIRAL)));
        }
      }
    }
    // Every tile of the storey with no floor at once, laid out before it is asked for (`planarea.ts`).
    entries.push(...this.areaFloorRows(b, level, x, y));
    // Pinned on a storey, the way up to the next from its floor: a flight or a ladder on the floor slot over it.
    if (pinned !== null && level + 1 < b.levels && !bld.floor(level + 1, x, y)) entries.push(...stairsUpEntries(g, base, level + 1, side,
      (at, lv, material, kind, sd, hand) => this.startPlacingStairs(at, lv, material, kind, sd, false, hand)));
    if (storey === undefined) entries.push(...cellarEntries(g, base, side, (material, kind, hand) => this.startPlacingStairs(base, 0, material, kind, side, true, hand)));
    // Pinned, the storeys are the top storey's work, and the roof its own level's (`storeyview.ts`).
    if (pinned === null || level === b.levels - 1) {
      if (pinned === null) entries.push(...roofEntries(g, b, base, act, item, build, (plan) => this.startPlanArea(plan)));
      entries.push(item(act('add_floor'), base));
      if (b.levels > 1) entries.push(item(act('remove_storey'), base));
    }
    if (storey === undefined) entries.push(item(act('remove_from_plan'), base));
    // The footprint dragged out over a rectangle from here, while it has one storey (`planarea.ts`).
    if (storey === undefined && b.levels === 1) entries.push({ label: 'Extend over an area', note: 'cursor: far corner · click to plan', onSelect: () => this.startPlanArea({ kind: 'footprint', buildingId: b.id, level: 0, anchor: { x, y } }) });
    entries.push(...this.undoRows());
    entries.push(item(act('rename_building'), base));
    return entries;
  }
}

/**
 * The rows for a flight or a ladder on the floor slot of storey `level`, up to it from the storey under it: planned
 * on the tile, Q and E turning the side it is climbed from (`startPlacingStairs`).
 */
function stairsUpEntries(g: Game, base: Extract<Target, { kind: 'tile' }>, level: number, side: Side,
  place: (at: Target, level: number, material: string, kind: 'stairs' | 'ladder', side: Side, hand?: StairHand) => void): MenuItem[] {
  const plan = BUILD_ACTION_BY_ID.get('plan_floor');
  if (!plan) return [];
  const at: Extract<Target, { kind: 'tile' }> = { ...base, level };
  const storey = `storey ${level + 1}`;
  const why = cellarReason(g, plan, { ...at, side, material: 'log', floorKind: 'stairs' });
  const spiral = spiralRow(g, at, `Plan ${SPIRAL_STAIRS_NAME} up (${storey})`, (material) => place(at, level, material, 'stairs', side, SPIRAL));
  if (why) return [{ label: `Plan staircase up (${storey})`, hint: why, disabled: true }, ...spiral];
  return [
    {
      label: `Plan staircase up (${storey})`,
      children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
        label: m.name,
        note: `${describeNeeds(floorBill(m.id, 'stairs'), materialName)} · Q/E: side`,
        onSelect: () => place(at, level, m.id, 'stairs', side),
      })),
    },
    {
      label: `Plan ${SINGLE_STAIRS_NAME} up (${storey})`,
      children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => ({
        label: m.name,
        note: `${describeNeeds(floorBill(m.id, 'stairs', undefined, 'l'), materialName)} · ${SINGLE_TURNS}`,
        onSelect: () => place(at, level, m.id, 'stairs', side, 'l'),
      })),
    },
    {
      label: `Plan ladder up (${storey})`,
      note: `${describeNeeds(floorBill('plank', 'ladder'), materialName)} · Q/E: side`,
      onSelect: () => place(at, level, 'plank', 'ladder', side),
    },
    ...spiral,
  ];
}

/** The roof's rows for a tile of a building: building or taking out the one there, or planning one. */
function roofEntries(g: Game, b: Building, base: Extract<Target, { kind: 'tile' }>, act: (id: string) => ActionDef,
  item: (def: ActionDef, target: Target, label?: string) => MenuItem,
  build: (def: ActionDef, target: Target, label: string, bill: Bill) => MenuItem,
  area?: (plan: AreaPlan) => void): MenuItem[] {
  const bld = g.buildings;
  const { x, y } = base;
  const entries: MenuItem[] = [];
  const plan = act('plan_floor');
  const roof = bld.floor(b.levels, x, y);
  const roofTarget: Target = { ...base, floorKind: 'roof' };
  if (roof) {
    if (!isDone(roof)) entries.push(build(act('build_floor'), roofTarget, `Build roof · needs ${describeNeeds(roof, materialName)}`, roof));
    entries.push(item(act('remove_floor'), roofTarget, 'Remove roof'));
  } else {
    const probe = cellarReason(g, plan, { ...roofTarget, material: 'log' });
    // And glass, which roofs and does nothing else: panes on timber bars, and a glasshouse when all of a one-storey roof is glass.
    const glassTarget: Target = { ...roofTarget, material: GLASS_ROOF.id };
    const glassWhy = cellarReason(g, plan, glassTarget);
    // Over a field it is the one roof there is (`glasshouse.ts`): the rest are offered, and say why not.
    const glassOnly = probe === FIELD_GLASS_ONLY;
    if (probe && (!glassOnly || glassWhy)) entries.push({ label: 'Plan roof', hint: (glassOnly ? glassWhy : probe) ?? undefined, disabled: true });
    else {
      /** A roof's materials, glass among them, in a shape the first tile chooses, or in the building's. */
      const roofRows = (shape?: RoofShape): MenuItem[] => {
        const t: Target = shape ? { ...roofTarget, roofShape: shape } : roofTarget;
        const glassAt: Target = { ...t, material: GLASS_ROOF.id };
        const glassNo = shape ? cellarReason(g, plan, glassAt) : glassWhy;
        return [
          ...MATERIALS.filter((m) => takesAs(m, { floor: 'roof' })).map((m) => ({
            label: m.name,
            note: describeNeeds(floorBill(m.id, 'roof', shape ?? roofShapeOf(b)), materialName),
            hint: glassOnly ? FIELD_GLASS_ONLY : undefined,
            disabled: glassOnly,
            onSelect: () => g.requestAction(plan, { ...t, material: m.id }),
          })),
          {
            label: GLASS_ROOF.name,
            note: describeNeeds(floorBill(GLASS_ROOF.id, 'roof', shape ?? roofShapeOf(b)), materialName),
            hint: glassNo ?? undefined,
            disabled: !!glassNo,
            onSelect: () => g.requestAction(plan, glassAt),
          },
          // What glass is for, in full, where it is chosen: a note is cut to its slot, a line is not.
          { label: 'Glasshouse: 1 storey, full-height walls all round, all-glass roof', disabled: true },
          { label: `Crop growth speed ×${GLASSHOUSE_GROWTH}, every season`, disabled: true },
        ];
      };
      entries.push({
        label: 'Plan roof',
        /*
         * The first tile of a roof chooses its shape as well: gabled, hipped,
         * or flat, which is a terrace, and which glass is not. After that the
         * shape is the building's.
         */
        children: b.roof ? roofRows() : ROOF_SHAPES.map((r) => ({ label: r.name, note: r.note, children: roofRows(r.id as RoofShape) })),
      });
    }
  }
  entries.push(...roofAreaRows(g, b, base, area));
  return entries;
}

/**
 * The whole roof at once: every tile of it not yet planned, in one material and, for the first, one shape, laid
 * out before it is asked for with its totals (`planarea.ts`). Offered while two or more tiles are left to plan.
 */
function roofAreaRows(g: Game, b: Building, base: Extract<Target, { kind: 'tile' }>, area?: (plan: AreaPlan) => void): MenuItem[] {
  if (!area) return [];
  const bld = g.buildings;
  const left = bld.roofTiles(b).filter(([x, y]) => !bld.floor(b.levels, x, y)).length;
  if (left < 2) return [];
  const rows = (shape?: RoofShape): MenuItem[] => [...MATERIALS.filter((m) => takesAs(m, { floor: 'roof' })), GLASS_ROOF].map((m) => ({
    label: m.name,
    note: `${describeNeeds(floorBill(m.id, 'roof', shape ?? roofShapeOf(b)), materialName)} each`,
    onSelect: () => area({ kind: 'roof', buildingId: b.id, level: b.levels - 1, material: m.id, roofShape: shape, anchor: { x: base.x, y: base.y } }),
  }));
  return [{
    label: 'Plan roof: every tile',
    note: `${left} tiles`,
    children: b.roof ? rows() : ROOF_SHAPES.map((r) => ({ label: r.name, note: r.note, children: rows(r.id as RoofShape) })),
  }];
}
