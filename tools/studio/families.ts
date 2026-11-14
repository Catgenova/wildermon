/**
 * The studio's families: every drawable asset in the game, by family and
 * kind, with what it has (views, states, variants, moving parts) and how one
 * is drawn into a cell. The page (`page.ts`) lays cells out and judges them
 * (`checks.ts`); this is only what there is and how to draw it.
 *
 * A family declares its register (`docs/aesthetic.md`): `line` for figures,
 * creatures and things you use (ligne claire), `paint` for the world they
 * stand in. A family whose things are drawn only from inside a scene (walls,
 * floors, piers, water) is catalogued as `scene` and seen on the `world`
 * family's scene strip rather than on a cell of its own.
 */
// The game's modules in the order the game loads them: `actions` before anything that reaches it through `traps`.
import '../../src/game/actions';
import { SPECIES, type SpeciesDef } from '../../src/game/creatures';
import { FURNITURE, furnitureDef } from '../../src/game/furniture';
import '../../src/render/gardenlook';
import { dyeTint } from '../../src/game/dyestuffs';
import { ENCHANTERS_PLINTH } from '../../src/game/enchant';
import { DEFAULT_LOOK, randomLook, type Look } from '../../src/game/look';
import { CROPS } from '../../src/game/farming';
import { SPELLS } from '../../src/game/arcane';
import { ARMOUR } from '../../src/game/gear';
import { RUNESTONE_IDS, type RunestoneId } from '../../src/game/runestones';
import type { Side } from '../../src/game/building';
import { BUSH_DEFS, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';
import { SEASONS, type Season } from '../../src/world/calendar';
import {
  drawFurniture, drawFurnitureLive, drawLampBloom, FURNITURE_HEIGHT, furnitureHoles, glowsAtNight, pieceView, WHEELS, WHEEL_STEPS, type PieceView,
} from '../../src/render/furniture';
import { isKit, kitBypass, kitSync } from '../../src/render/kitpieces';
import { KIT_PIECES } from '../../src/render/kit/index';
import { denSync, drawDen, isDen } from '../../src/render/dens';
import { drawAnvil, drawAnvilNight, drawKiln, drawKilnNight, drawSmelter, drawSmelterNight } from '../../src/render/forge';
import { drawRunestone } from '../../src/render/runestone';
import { DEED_TOTEM_VARIANTS, drawDeedTotem } from '../../src/render/deedtotem';
import { drawRuneLantern, RUNE_LANTERN_VARIANTS } from '../../src/render/runelantern';
import { drawRuneGate } from '../../src/render/runegate';
import { drawMemorial } from '../../src/render/memorial';
import {
  bushSprite, drawCampfire, drawCreature, drawDeck, drawPlayer, drawPortrait, drawTrap, lyingSprite, spriteScaleFor, stumpSprite, treeSprite,
  type CreaturePose, type PlayerPose, type PortraitMotion, type Sprite,
} from '../../src/render/sprites';
import { loadAllWildermon, modelled } from '../../src/render/wildermon';
import { ACT_SECS } from '../../src/render/beasts';
import type { GearLook } from '../../src/render/figure';
import { BUSH3D_SPECIES, log3dSprite, STUMP3D_SPECIES, TREE3D_SPECIES, tree3dFrame, tree3dIdle, type TreeView } from '../../src/render/trees3d/index';
import { FLOWER_COLOURS, flowerSprite } from '../../src/render/flowers';
import { fieldBake } from '../../src/render/crops';
import { spellSheet } from '../../src/render/spells/preview';
import { visualOf } from '../../src/render/spells/index';
import { drawShine, shines } from '../../src/render/shine';
import { campfireHit, drawCampfireNight } from '../../src/render/kit/campfire';
import { FIRE_CAPACITY } from '../../src/game/campfire';
import { NIGHT_WASH } from '../../src/render/nightwash';

export type Ctx = CanvasRenderingContext2D;
export type Box = [number, number, number, number];
export type Register = 'line' | 'paint';
/** How a thing is drawn today: in the rune pastel kit, as a posed model, an old box model, a flat painted sprite, or only from inside a scene. */
export type Style = 'kit' | 'model' | 'old' | 'flat' | 'scene';

/** One way a thing can vary, and what to set to draw it so. */
export interface Variant { label: string; set: Partial<Opts> }
/** One thing that moves, and how many frames of it to show. */
export interface Motion {
  id: string;
  label: string;
  frames: number;
  set?: Partial<Opts>;
  secs?: number;
  /** A move not every kind of the family has: frames that do not change are no fault. */
  optional?: boolean;
}

export interface Asset {
  family: string;
  kind: string;
  name: string;
  register: Register;
  style: Style;
  /** What draws it, and in which file. */
  entry: string;
  file: string;
  /** What turns it: the camera's eight turns, a body's eight facings, or nothing. */
  views: 'turns' | 'facings' | 'none';
  states: Variant[];
  variants: Variant[];
  motions: Motion[];
  /** Whether it lights, glows or has an emissive: judged alive at night. */
  emissive: boolean;
  /** Its footprint in subtiles, for the pale squares under it, when it has one. */
  footprint?: [number, number];
  /** Its height at zoom one as the game has it, for the size check, when the game says. */
  heightPx?: number;
  /** Which of docs/aesthetic's references it is held against, by number. */
  ref: number;
}

/** What one cell asks for. */
export interface Opts {
  /** The camera's turn, 0 to 7. */
  turn: number;
  /** A body's facing, 0 to 7; a piece's side for furniture. */
  facing: number;
  side: Side;
  night: number;
  lit: boolean;
  /** A state, a trim, a layer, a stage: what the asset's `states` name. */
  state: number;
  variant: number;
  /** The drawing clock, seconds. */
  t: number;
  /** A frame of a motion, 0 to frames - 1, and its share 0 to 1. */
  frame: number;
  u: number;
  motion: string;
  tint?: string;
  material?: string;
  season: Season;
  day: number;
  hour: number;
  stage: number;
  look?: Look;
  gear?: GearLook;
  pose?: string;
  dormant?: boolean;
  /** A crop's stage tended (`Crop.tendedNow`). */
  tended?: boolean;
}

export const DEFAULTS: Opts = {
  turn: 0, facing: 1, side: 's', night: 0, lit: false, state: 0, variant: 0, t: 0, frame: 0, u: 0, motion: '', season: 'summer', day: 30, hour: 13, stage: 0,
};

export interface Family {
  id: string;
  register: Register;
  ref: number;
  /** What the family is for, a line. */
  about: string;
  list(): Asset[];
  /** Anything to fetch or bake before a kind is drawn (a line's models, a tree's bakes). */
  prepare?(a: Asset, o: Opts): Promise<void>;
  /** Draw it with its floor contact at (sx, sy), at `zoom`; the box it says it drew in, when it says. */
  draw(ctx: Ctx, sx: number, sy: number, zoom: number, a: Asset, o: Opts): Box | void;
  /** A family drawn as a whole sheet of its own (spells): the canvas, instead of cells. */
  whole?(a: Asset, o: Opts): HTMLCanvasElement;
  /** The same thing drawn by the live path rather than from a kept picture, where the family keeps one: what tools/bodies.ts compares. */
  fresh?(o: Opts): Opts;
  /** A thing drawn afresh each call from a body kept between frames (the mirror): two draws need not agree. */
  unsteady?: boolean;
  /** A family that is all splash (a flower): the splash's share is not bounded. */
  splashy?: boolean;
  /**
   * After the night's wash: the holes it cuts in the wash and what it draws over it, as the renderer does
   * (`furnitureHoles`, `drawSmelterNight`, a lamp's bloom). Without one, what the asset itself draws bright and
   * coloured at night is taken as emissive and laid over the wash.
   */
  night?(ctx: Ctx, sx: number, sy: number, zoom: number, a: Asset, o: Opts, hole: (x: number, y: number, r: number, alpha: number) => void): void;
}

/* ---- small helpers ----------------------------------------------------------------------- */

/** The drawing clock as every `t = performance.now() / 1000` default reads it, set for one drawing. */
export function withClock<T>(t: number, fn: () => T): T {
  const was = performance.now;
  performance.now = () => t * 1000;
  try { return fn(); } finally { performance.now = was; }
}

const SIDES: Side[] = ['s', 'e', 'n', 'w'];
const states = (labels: string[]): Variant[] => labels.map((label, state) => ({ label, set: { state } }));
const frames = (id: string, label: string, n: number, set: Partial<Opts> = {}, secs?: number): Motion => ({ id, label, frames: n, set, secs });
const sprite = (ctx: Ctx, sx: number, sy: number, zoom: number, s: Sprite | null | undefined): void => {
  if (s) ctx.drawImage(s.canvas, sx - s.ax * zoom, sy - s.ay * zoom, s.w * zoom, s.h * zoom);
};

/** A look of a seed, the same every run. */
export function lookOf(seed: number): Look {
  let x = (seed * 2654435761) >>> 0;
  return randomLook(() => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; });
}

/** Gear by class, as the armour table has it, with a sword and a shield for the armoured sets. */
export function gearOf(cls: string): GearLook | undefined {
  if (cls === 'none') return undefined;
  const g: GearLook = {};
  for (const a of ARMOUR) if (a.cls === cls && (a.slot === 'head' || a.slot === 'chest' || a.slot === 'shawl' || a.slot === 'legs' || a.slot === 'feet')) g[a.slot] = { id: a.id, material: cls === 'cloth' || cls === 'leather' ? undefined : 'iron' };
  if (cls !== 'cloth') g.weapon = { id: 'sword', material: 'iron' };
  if (cls === 'chain' || cls === 'plate') g.offhand = { id: 'metal_shield', material: 'iron' };
  return g;
}

/* ---- furniture: the old box models, the kit, the beds, the plinth ------------------------ */

const WOODS = ['oak', 'birch', 'cherry', 'plum'];
const DYE = '#4f7ec8';

const furniture: Family = {
  id: 'furniture', register: 'line', ref: 4,
  about: 'Furniture, stations and stores: drawFurniture, in the rune pastel kit (KIT_PIECES) or the old box models (MODELS), plus the wildermon beds and the enchanter\'s plinth.',
  list: () => FURNITURE.map((f): Asset => {
    const kit = isKit(f.id) ? KIT_PIECES[f.id] : undefined;
    const den = isDen(f.id);
    const wheels = WHEELS[f.id];
    const plinth = f.id === ENCHANTERS_PLINTH;
    const style: Style = kit || den || plinth ? 'kit' : 'old';
    const st: Variant[] = kit?.states ? kit.states.map((s) => ({ label: s.label, set: { state: s.trim } })) : plinth ? states(['bare', 'runed 1', 'runed 2']) : [];
    if (kit?.layers) for (let i = 0; i < kit.layers; i++) st.push({ label: `layer ${i}`, set: { state: i } });
    const vars: Variant[] = [{ label: `dyed ${DYE}`, set: { tint: DYE } }, ...WOODS.map((m) => ({ label: m, set: { material: m } }))];
    if (den) vars.push({ label: 'sleeper', set: { variant: 1 } });
    const motions: Motion[] = [];
    if (kit?.live || (!kit && !den && !plinth)) motions.push(frames('live', 'live (drawn over the bake)', 6, { lit: true }));
    if (kit?.flicker) motions.push(frames('flicker', `flicker, ${kit.flicker} baked frames`, kit.flicker, { lit: true }));
    if (kit?.wind) motions.push(frames('wind', 'cloth in the wind', 6));
    if (wheels) motions.push(frames('wheels', `wheels, ${wheels.spokes} spokes`, Math.min(8, wheels.spokes * WHEEL_STEPS)));
    if (den) motions.push(frames('breath', 'a sleeper\'s breath', 6, { variant: 1 }));
    const lit = glowsAtNight(f.id) || !!kit?.flicker || /lamp|brazier|oven|lantern|altar|fire/.test(f.id);
    return {
      family: 'furniture', kind: f.id, name: f.name, register: 'line', style,
      entry: den ? 'drawDen' : plinth ? 'drawPlinth' : kit ? `drawKit (${f.id})` : `drawFurniture MODELS.${f.id}`,
      file: den ? 'src/render/dens.ts' : plinth ? 'src/render/plinth.ts' : kit ? `src/render/kit/${kitFile(f.id)}.ts` : 'src/render/furniture.ts',
      views: 'turns', states: st, variants: vars, motions, emissive: lit || !!kit?.flicker, footprint: [f.w, f.h], heightPx: FURNITURE_HEIGHT[f.id], ref: 4,
    };
  }),
  // A carved figure is drawn from its kind's model (`gardenlook.ts`): every line in before it is drawn.
  prepare: async (a) => { if (a.kind === 'carved_figure') await loadAllWildermon(); },
  draw: (ctx, sx, sy, zoom, a, o) => {
    const view = pieceView(o.side, o.turn);
    const t = o.t;
    if (isDen(a.kind) && o.variant === 1) {
      const sp = SPECIES.rabba;
      return withClock(t, () => drawDen(ctx, sx, sy, zoom, a.kind, view, { sleeper: { colors: sp.variants[0], species: 'rabba', stage: 0, seed: 0.3 } }, t, true));
    }
    const wheels = WHEELS[a.kind];
    const trim = wheels && o.motion === 'wheels' ? o.frame : o.state;
    kitBypass(false);
    const box = withClock(t, () => drawFurniture(ctx, sx, sy, zoom, a.kind, o.lit, o.tint ? dyeTint(o.tint) ?? undefined : undefined, trim, view, o.material));
    if (o.motion === 'live' || o.motion === 'wind') {
      const air = { x: Math.cos(t * 0.7), y: Math.sin(t * 0.7), force: 0.8, t };
      withClock(t, () => drawFurnitureLive(ctx, sx, sy, zoom, a.kind, view, o.night, air));
    }
    return box;
  },
  night: (ctx, sx, sy, zoom, a, o, hole) => {
    const view = pieceView(o.side, o.turn);
    if (!o.lit) return;
    for (const h of furnitureHoles(sx, sy, zoom, a.kind, view)) hole(h.x, h.y, h.r, h.a);
    withClock(o.t, () => {
      // A lamp's bloom, as the renderer lays it over the wash for a lamp that burns (nothing for a piece with no lamp).
      drawLampBloom(ctx, sx, sy, zoom, a.kind, view, o.night);
      drawFurnitureLive(ctx, sx, sy, zoom, a.kind, view, o.night);
    });
  },
};

/** Which file a kit piece's model is in, by the registry's imports. */
function kitFile(kind: string): string {
  const by: Record<string, string> = {
    altar: 'altar', hive: 'apiary', skep: 'apiary', banner: 'banners', flagpole: 'banners', barrel: 'barrel', small_barrel: 'barrel', large_barrel: 'barrel',
    bed: 'beds', cot: 'beds', tent: 'beds', bell: 'bell', bulk_bin: 'bins', craft_bin: 'bins', seed_bin: 'bins', sprout_bin: 'bins', brazier: 'brazier',
    cupboard: 'cases', larder: 'cases', wardrobe: 'cases', chair: 'chair', chest: 'chest', coffer: 'coffer', butter_churn: 'crafts', loom: 'crafts',
    paper_press: 'crafts', potters_wheel: 'crafts', spindle: 'crafts', creature_crate: 'creature-crate', firewood_rack: 'firewood', fountain: 'fountain',
    grave: 'grave', lamp_pillar: 'lamps', lamp_post: 'lamps', mailbox: 'mailbox', oven: 'oven', planter: 'planter', fish_pond: 'pond',
    lavender_arch: 'rosearch', rose_arch: 'rosearch', stone_lavender_arch: 'rosearch', stone_rose_arch: 'rosearch', bench: 'seating', stool: 'seating',
    bookshelf: 'shelving', crate_shelf: 'shelving', shelves: 'shelving', great_sign: 'signs', sign: 'signs', stall: 'stall', coat_rack: 'stands',
    lectern: 'stands', statue: 'statue', table: 'tables', long_table: 'tables', desk: 'tables', trash_crate: 'trash', trellis: 'trellis', well: 'turnery',
  };
  return by[kind] ?? kind;
}

/* ---- the forge: smelter, kiln, anvil ----------------------------------------------------- */

const forge: Family = {
  id: 'forge', register: 'line', ref: 4,
  about: 'The smith\'s pieces in the kit: the smelter, the kiln and the anvil, each with a lit state and fire drawn live.',
  list: () => [
    { kind: 'smelter', name: 'Smelter', entry: 'drawSmelter', states: states(['cold', 'lit', 'working']) },
    { kind: 'kiln', name: 'Kiln', entry: 'drawKiln', states: states(['cold', 'lit', 'firing']) },
    { kind: 'anvil', name: 'Anvil', entry: 'drawAnvil', states: [] },
  ].map((k): Asset => ({
    family: 'forge', kind: k.kind, name: k.name, register: 'line', style: 'kit', entry: k.entry, file: 'src/render/forge.ts', views: 'turns',
    states: k.states, variants: k.kind === 'anvil' ? [0, 1, 2].map((v) => ({ label: `variant ${v}`, set: { variant: v } })) : [],
    motions: [frames('live', k.kind === 'anvil' ? 'sparks' : 'fire and heat, live', 6, { state: 2 })], emissive: true, footprint: [1, 1], ref: 4,
  })),
  draw: (ctx, sx, sy, zoom, a, o) => withClock(o.t, () => {
    if (a.kind === 'smelter') return drawSmelter(ctx, sx, sy, zoom, o.turn, { lit: o.state >= 1, working: o.state >= 2 }, o.night, o.t, true);
    if (a.kind === 'kiln') return drawKiln(ctx, sx, sy, zoom, o.turn, { lit: o.state >= 1, firing: o.state >= 2 }, o.night, o.t, true);
    return drawAnvil(ctx, sx, sy, zoom, '#a6b2c6', '#535d78', o.turn, o.variant, o.night, o.t, true);
  }),
  night: (ctx, sx, sy, zoom, a, o) => withClock(o.t, () => {
    if (a.kind === 'smelter') { if (o.state >= 1) drawSmelterNight(ctx, sx, sy, zoom, o.turn, { lit: true, working: o.state >= 2 }, o.night, o.t, 0); }
    else if (a.kind === 'kiln') { if (o.state >= 1) drawKilnNight(ctx, sx, sy, zoom, o.turn, { lit: true, firing: o.state >= 2 }, o.night, o.t, 0); }
    else drawAnvilNight(ctx, sx, sy, zoom, '#a6b2c6', '#535d78', o.turn, o.variant, o.night, o.t, 0);
  }),
};

/* ---- runes: the standing stones, the totem, the lantern, the gate, the memorial ---------- */

const rune: Family = {
  id: 'rune', register: 'line', ref: 6,
  about: 'The runestone kit\'s own pieces: the five standing stones, a settlement\'s totem by level, the rune lantern, the rune gate and the memorial, all with glows that breathe and motes that rise.',
  list: () => [
    ...RUNESTONE_IDS.map((id): Asset => ({
      family: 'rune', kind: id, name: `Runestone ${id}`, register: 'line', style: 'kit', entry: 'drawRunestone', file: 'src/render/runestone.ts', views: 'turns',
      states: [], variants: [], motions: [frames('glow', 'runes breathing, motes rising', 6)], emissive: true, footprint: [3, 3], ref: 6,
    })),
    {
      family: 'rune', kind: 'totem', name: 'Deed totem', register: 'line', style: 'kit', entry: 'drawDeedTotem', file: 'src/render/deedtotem.ts', views: 'turns',
      states: states(['level 1', 'level 2', 'level 3', 'level 4', 'level 5']),
      variants: Array.from({ length: DEED_TOTEM_VARIANTS }, (_, v) => ({ label: `variant ${v}`, set: { variant: v } })),
      motions: [frames('bloom', 'bloom and glow', 6)], emissive: true, footprint: [1, 1], ref: 6,
    },
    {
      family: 'rune', kind: 'lantern', name: 'Rune lantern', register: 'line', style: 'kit', entry: 'drawRuneLantern', file: 'src/render/runelantern.ts', views: 'turns',
      states: states(['moss 0', 'moss 1', 'moss 2', 'moss 3']),
      variants: Array.from({ length: RUNE_LANTERN_VARIANTS }, (_, v) => ({ label: `variant ${v}`, set: { variant: v } })),
      motions: [frames('bloom', 'bloom and motes', 6)], emissive: true, footprint: [1, 1], ref: 6,
    },
    {
      family: 'rune', kind: 'gate', name: 'Rune gate', register: 'line', style: 'kit', entry: 'drawRuneGate', file: 'src/render/runegate.ts', views: 'turns',
      states: states(['dark', 'lit']), variants: [0, 1, 2].map((v) => ({ label: `variant ${v}`, set: { variant: v } })),
      motions: [frames('rise', 'opening, lit', 6, { state: 1 })], emissive: true, footprint: [1, 3], ref: 6,
    },
    {
      family: 'rune', kind: 'memorial', name: 'Memorial stone', register: 'line', style: 'kit', entry: 'drawMemorial', file: 'src/render/memorial.ts', views: 'turns',
      states: [], variants: SIDES.map((s) => ({ label: `facing ${s}`, set: { side: s } })), motions: [frames('glow', 'glow', 4)], emissive: true, footprint: [1, 1], ref: 6,
    },
  ],
  draw: (ctx, sx, sy, zoom, a, o) => withClock(o.t, () => {
    if ((RUNESTONE_IDS as readonly string[]).includes(a.kind)) return drawRunestone(ctx, sx, sy, zoom, a.kind as RunestoneId, o.turn, o.night, o.t);
    if (a.kind === 'totem') return drawDeedTotem(ctx, sx, sy, zoom, { level: o.state + 1, variant: o.variant }, o.turn, o.night, o.t, true);
    if (a.kind === 'lantern') return drawRuneLantern(ctx, sx, sy, zoom, { facing: o.side, stage: o.state, stages: 3, variant: o.variant }, o.turn, o.night, o.t, true);
    if (a.kind === 'gate') {
      const rise = o.motion === 'rise' ? o.u : 1;
      for (const layer of ['back', 'front'] as const) drawRuneGate(ctx, sx, sy, zoom, 'h', o.turn, o.variant, o.state, 0, rise, o.night, o.t, layer);
      return;
    }
    return drawMemorial(ctx, sx, sy, zoom, o.side, o.turn, 'Here lies a studio test', o.night, o.t);
  }),
};

/* ---- devices on the ground: campfire, traps, decks --------------------------------------- */

/** A campfire's states on its sheet: alight or not, its fuel as a share of what it holds, and lots of ashes in it. */
const FIRE_STATES: Array<{ label: string; lit: boolean; fuel: number; ash: number }> = [
  { label: 'laid', lit: false, fuel: 0.02, ash: 0 },
  { label: 'stacked full', lit: false, fuel: 1, ash: 0 },
  { label: 'out', lit: false, fuel: 0, ash: 0 },
  { label: 'out, ashes', lit: false, fuel: 0, ash: 3 },
  { label: 'dying', lit: true, fuel: 0.02, ash: 2 },
  { label: 'lit, 1/4', lit: true, fuel: 0.15, ash: 2 },
  { label: 'lit, half', lit: true, fuel: 0.4, ash: 1 },
  { label: 'lit, 3/4', lit: true, fuel: 0.6, ash: 0 },
  { label: 'lit, full', lit: true, fuel: 1, ash: 0 },
];

/** How many things lie in the sack on its sheet. */
const SACK_COUNTS = [1, 4, 20];

const device: Family = {
  id: 'device', register: 'line', ref: 4,
  about: 'Things laid on the ground and drawn flat each frame: the campfire, the traps and a bridge\'s deck pieces.',
  list: () => [
    {
      family: 'device', kind: 'campfire', name: 'Campfire', register: 'line', style: 'kit', entry: 'drawCampfire', file: 'src/render/kit/campfire.ts', views: 'turns',
      states: FIRE_STATES.map((f, state) => ({ label: f.label, set: { state } })),
      variants: [],
      motions: [frames('fire', 'flames, sparks and glow, full', 6, { state: 8 }, 1.2), frames('dying', 'dying embers', 6, { state: 4 }, 1.2)], emissive: true, footprint: [2, 2], ref: 4,
    },
    {
      family: 'device', kind: 'sack', name: 'Dropped items sack', register: 'line', style: 'kit', entry: 'lyingSprite', file: 'src/render/kit/sack.ts', views: 'none',
      states: SACK_COUNTS.map((n) => ({ label: `${n} item${n > 1 ? 's' : ''}`, set: { state: n } })),
      variants: [1, 2, 3].map((r) => ({ label: `rare ${r}`, set: { variant: r } })),
      motions: [frames('shine', 'rare shine, rare 3', 6, { variant: 3 }, 1.5)], emissive: false, footprint: [1, 1], ref: 4,
    },
    ...['snare', 'creel', 'deadfall'].map((k): Asset => ({
      family: 'device', kind: `trap_${k}`, name: `Trap: ${k}`, register: 'line', style: 'flat', entry: 'drawTrap', file: 'src/render/sprites.ts', views: 'none',
      states: states(['set', 'baited', 'sprung']), variants: [], motions: [], emissive: false, footprint: [1, 1], ref: 4,
    })),
    ...['plank', 'log', 'stone', 'rope'].map((k): Asset => ({
      family: 'device', kind: `deck_${k}`, name: `Deck: ${k}`, register: 'line', style: 'flat', entry: 'drawDeck', file: 'src/render/sprites.ts', views: 'none',
      states: states(['building', 'done']), variants: [0, 0.5, 1].map((g) => ({ label: `moss ${g}`, set: { variant: Math.round(g * 10) } })), motions: [], emissive: false, footprint: [1, 1], ref: 2,
    })),
  ],
  draw: (ctx, sx, sy, zoom, a, o) => {
    if (a.kind === 'campfire') {
      const f = FIRE_STATES[o.state] ?? FIRE_STATES[0];
      drawCampfire(ctx, sx, sy, zoom, f.lit, f.fuel * FIRE_CAPACITY, o.t, o.turn, f.ash);
      return campfireHit(f.lit, f.fuel * FIRE_CAPACITY, o.turn, f.ash).map((v) => v * zoom) as Box;
    }
    if (a.kind === 'sack') {
      spriteScaleFor(zoom);
      const spr = lyingSprite([{ id: 'rock', count: o.state || 1 }], 3, 4);
      sprite(ctx, sx, sy, zoom, spr);
      if (shines(o.variant)) drawShine(ctx, sx, sy, zoom, o.variant, 3 * 4099 + 4, o.t, spr.w * zoom, spr.ay * zoom);
      return;
    }
    if (a.kind.startsWith('trap_')) { drawTrap(ctx, sx, sy, zoom, a.kind.slice(5), o.state === 1, o.state === 2); return; }
    drawDeck(ctx, sx, sy, zoom, a.kind.slice(5), o.state >= 1, 0, undefined, o.variant / 10, 3);
  },
  night: (ctx, sx, sy, zoom, a, o) => {
    // A lit campfire's fire laid again as light over the wash, as the renderer lays it.
    const f = FIRE_STATES[o.state];
    if (a.kind === 'campfire' && f?.lit) drawCampfireNight(ctx, sx, sy, zoom, f.fuel * FIRE_CAPACITY, o.night, o.t, NIGHT_WASH.alpha * o.night);
  },
};

/* ---- creatures: every species, stage, variant, act ---------------------------------------- */

const creature: Family = {
  id: 'creature', register: 'line', ref: 6,
  about: 'Wildermon and monsters: SPECIES, each stage and variant (or subspecies), standing, walking, running, striking, at work, casting and evolving (drawCreature).',
  list: () => Object.values(SPECIES).map((d: SpeciesDef): Asset => {
    const model = modelled(d.id);
    const st = d.stages ? [{ label: d.name, set: { stage: 0 } }, ...d.stages.map((s, i) => ({ label: s.name, set: { stage: i + 1 } }))] : [];
    const vars = d.variants.map((v, i) => ({ label: d.subspecies ? d.subspecies[i] : `variant ${i} ${v[0]}/${v[1]}`, set: { variant: i } }));
    const motions: Motion[] = [
      frames('stand', 'standing loop', 6, { pose: 'stand' }, 24), frames('walk', 'walk, a stride', 6, { pose: 'walk' }), frames('run', 'run, a stride', 6, { pose: 'run' }),
    ];
    if (model) {
      for (const act of ['strike', 'work', 'cast', 'evolve'] as const) {
        const m = frames(act, `${act}, ${ACT_SECS[act]} s`, 6, { pose: act }, ACT_SECS[act]);
        // Only a kind with a task works, only one with an ability casts: the rest stand through it, which is no fault.
        m.optional = act === 'cast' ? !d.ability : act === 'work' ? !d.gathers && !d.trades?.length : false;
        motions.push(m);
      }
    }
    return {
      family: 'creature', kind: d.id, name: d.name, register: 'line', style: model ? 'model' : 'flat', entry: model ? 'drawCreature → drawWildermon' : 'drawCreature (sprite)',
      file: model ? `src/render/wild-*.ts (LINES.${d.id})` : 'src/render/sprites.ts', views: 'facings', states: st, variants: vars, motions,
      emissive: !!d.ability || d.id === 'whispet' || d.id === 'crumbud', ref: 6,
    };
  }),
  prepare: async () => { await loadAllWildermon(); },
  // A hair of gait, standing: drawn through the mesh rather than put down from its kept picture, as tools/bodies.ts does.
  fresh: (o) => ({ ...o, pose: 'stand-fresh' }),
  draw: (ctx, sx, sy, zoom, a, o) => {
    const d = SPECIES[a.kind];
    const pose: CreaturePose = {
      species: a.kind, facing: o.facing, phase: o.t * 2, moving: false, gait: o.pose === 'stand-fresh' ? 0.03 : 0, colors: d.variants[o.variant] ?? d.variants[0], health: 1, stage: o.stage, variant: o.variant, fleece: 1,
    };
    const p = o.pose ?? 'stand';
    if (p === 'walk' || p === 'run') { pose.moving = true; pose.gait = p === 'run' ? 1 : 0; pose.phase = o.u * 2; }
    else if (p !== 'stand' && p !== 'stand-fresh') pose.act = { kind: p as 'strike', t: o.u };
    withClock(o.t, () => drawCreature(ctx, sx, sy, zoom, pose));
  },
};

/* ---- the player: looks, gear, poses -------------------------------------------------------- */

const LOOKS: Array<[string, Look]> = [['default', DEFAULT_LOOK], ['look 7', lookOf(7)], ['look 23', lookOf(23)], ['look 101', lookOf(101)]];
const GEARS = ['none', 'cloth', 'leather', 'chain', 'plate', 'scale'];

const player: Family = {
  id: 'player', register: 'line', ref: 7,
  about: 'A person: the rig in src/render/figure.ts dressed from a Look and gear (drawPlayer), standing, walking, running, at work, swimming, waving and hopping.',
  list: () => LOOKS.map(([label, look]): Asset => ({
    family: 'player', kind: label.replace(' ', ''), name: `Player, ${label} look`, register: 'line', style: 'model', entry: 'drawPlayer → drawFigure', file: 'src/render/figure.ts', views: 'facings',
    states: GEARS.map((g, i) => ({ label: `gear ${g}`, set: { state: i } })), variants: [],
    motions: [
      frames('idle', 'standing', 6, { pose: 'idle' }, 6), frames('walk', 'walk', 6, { pose: 'walk' }), frames('run', 'run', 6, { pose: 'run' }), frames('work', 'at work', 6, { pose: 'work' }, 2),
      frames('swim', 'swimming', 6, { pose: 'swim' }), frames('wave', 'wave', 6, { pose: 'wave' }), frames('hop', 'hop', 6, { pose: 'hop' }),
    ],
    emissive: false, heightPx: 44, ref: 7, ...({ look } as object),
  })),
  draw: (ctx, sx, sy, zoom, a, o) => {
    const look = (a as Asset & { look: Look }).look;
    const pose: PlayerPose = { phase: o.t * 6, moving: false, facing: o.facing, swimming: false, working: false, look, gear: gearOf(GEARS[o.state] ?? 'none') };
    const p = o.pose ?? 'idle';
    if (p === 'walk' || p === 'run') { pose.moving = true; pose.gait = p === 'run' ? 1 : 0; pose.phase = o.u * 2; }
    else if (p === 'work') pose.working = true;
    else if (p === 'swim') { pose.swimming = true; pose.moving = true; pose.phase = o.u * 2; }
    else if (p === 'wave' || p === 'hop') { pose.emote = p; pose.emoteT = o.u; }
    withClock(o.t, () => drawPlayer(ctx, sx, sy, zoom, pose));
  },
};

const portrait: Family = {
  id: 'portrait', register: 'line', ref: 7,
  about: 'The creator\'s mirror: the same figure big in a square (drawPortrait), standing, walking, running, working, waving, hopping.',
  list: () => LOOKS.map(([label, look]): Asset => ({
    family: 'portrait', kind: label.replace(' ', ''), name: `Portrait, ${label} look`, register: 'line', style: 'model', entry: 'drawPortrait', file: 'src/render/sprites.ts', views: 'facings',
    states: [], variants: [], motions: (['idle', 'walk', 'run', 'work', 'wave', 'hop'] as PortraitMotion[]).map((m) => frames(m, m, 6, { pose: m }, 2)), emissive: false, ref: 7, ...({ look } as object),
  })),
  unsteady: true,
  draw: (ctx, sx, sy, zoom, a, o) => {
    const look = (a as Asset & { look: Look }).look;
    const w = 60 * zoom, h = 100 * zoom;
    withClock(o.t, () => drawPortrait(ctx, sx - w / 2, sy - h, w, h, look, o.t + o.u * 2, o.facing, (o.pose ?? 'idle') as PortraitMotion));
  },
};

/* ---- the trees, the bushes, the stumps, the logs ------------------------------------------- */

const AGES = TREE_AGES.map((a, i) => ({ label: `age ${i}`, set: { variant: i } }));
const seasonsOf = (): Variant[] => SEASONS.map((s) => ({ label: s, set: { season: s } }));
const treeView = (o: Opts): TreeView => ({ x: 20, y: 20, turn: o.turn, hour: o.hour, dark: o.night, sway: o.motion === 'sway' ? o.frame % 4 : 0 });

/** Bake a solid until it is there: the renderer's frame and its idle, over and over. */
async function bake(want: () => Sprite | null | undefined): Promise<void> {
  for (let i = 0; i < 400; i++) {
    tree3dFrame();
    const s = want();
    if (s && (s.solid || (s as { baked?: boolean }).baked !== false) && (s as Sprite).solid !== false) return;
    tree3dIdle(200, null, 20, 20);
    await new Promise((r) => setTimeout(r, 0));
  }
}

const tree: Family = {
  id: 'tree', register: 'paint', ref: 2,
  about: 'Trees by species and age: grown as solids and baked for each turn, sun step and wind frame (trees3d), or drawn flat (treeSprite).',
  list: () => TREE_DEFS.map((d, i): Asset => ({
    family: 'tree', kind: d.name.toLowerCase(), name: d.name, register: 'paint', style: TREE3D_SPECIES.has(i) ? 'model' : 'flat',
    entry: TREE3D_SPECIES.has(i) ? 'tree3dSprite' : 'treeSprite (paintTree)', file: TREE3D_SPECIES.has(i) ? `src/render/trees3d/species/${d.name.toLowerCase()}.ts` : 'src/render/trees/',
    views: 'turns', states: AGES, variants: seasonsOf(), motions: TREE3D_SPECIES.has(i) ? [frames('sway', 'wind, 4 baked frames', 4), frames('sun', 'the sun\'s steps', 8)] : [], emissive: false, ref: 2,
  })),
  prepare: async (a, o) => { await bake(() => treeSprite(speciesIndex(a.kind), o.variant, o.season, o.day, treeView(o))); },
  draw: (ctx, sx, sy, zoom, a, o) => {
    spriteScaleFor(zoom);
    const v = treeView(o);
    if (o.motion === 'sun') v.hour = 4 + (o.frame / 7) * 16;
    sprite(ctx, sx, sy, zoom, treeSprite(speciesIndex(a.kind), o.variant, o.season, o.day, v));
  },
};
const speciesIndex = (kind: string): number => Math.max(0, TREE_DEFS.findIndex((d) => d.name.toLowerCase() === kind));
const bushIndex = (kind: string): number => Math.max(0, BUSH_DEFS.findIndex((d) => d.name.toLowerCase().replace(/ /g, '_') === kind));

const bush: Family = {
  id: 'bush', register: 'paint', ref: 2,
  about: 'Bushes by species through the year: solids (rose, thorn, lavender) or flat.',
  list: () => BUSH_DEFS.map((d, i): Asset => ({
    family: 'bush', kind: d.name.toLowerCase().replace(/ /g, '_'), name: d.name, register: 'paint', style: BUSH3D_SPECIES.has(i) ? 'model' : 'flat',
    entry: BUSH3D_SPECIES.has(i) ? 'bush3dSprite' : 'bushSprite', file: BUSH3D_SPECIES.has(i) ? 'src/render/trees3d/species/' : 'src/render/sprites.ts',
    views: 'turns', states: [], variants: seasonsOf(), motions: BUSH3D_SPECIES.has(i) ? [frames('sway', 'wind, 4 baked frames', 4)] : [], emissive: false, ref: 2,
  })),
  prepare: async (a, o) => { await bake(() => bushSprite(bushIndex(a.kind), o.season, o.day, treeView(o))); },
  draw: (ctx, sx, sy, zoom, a, o) => { spriteScaleFor(zoom); sprite(ctx, sx, sy, zoom, bushSprite(bushIndex(a.kind), o.season, o.day, treeView(o))); },
};

const stump: Family = {
  id: 'stump', register: 'paint', ref: 2,
  about: 'What a felled tree leaves: the stump and the logs, in the species\' bark.',
  list: () => TREE_DEFS.flatMap((d, i): Asset[] => [
    {
      family: 'stump', kind: d.name.toLowerCase(), name: `${d.name} stump`, register: 'paint', style: STUMP3D_SPECIES.has(i) ? 'model' : 'flat', entry: 'stumpSprite / stump3dSprite',
      file: 'src/render/trees3d/stump.ts', views: 'turns', states: [], variants: seasonsOf(), motions: [], emissive: false, ref: 2,
    },
    {
      family: 'stump', kind: `${d.name.toLowerCase()}_logs`, name: `${d.name} logs`, register: 'paint', style: 'model', entry: 'log3dSprite',
      file: 'src/render/trees3d/stump.ts', views: 'turns', states: states(['1 log', '2 logs', '3 logs']), variants: seasonsOf(), motions: [], emissive: false, ref: 2,
    },
  ]),
  prepare: async (a, o) => {
    const logs = a.kind.endsWith('_logs');
    const sp = speciesIndex(logs ? a.kind.slice(0, -5) : a.kind);
    await bake(() => (logs ? log3dSprite(sp, o.state + 1, o.season, treeView(o), 2, false) : stumpSprite(sp, o.season, o.day, treeView(o))));
  },
  draw: (ctx, sx, sy, zoom, a, o) => {
    spriteScaleFor(zoom);
    const logs = a.kind.endsWith('_logs');
    const sp = speciesIndex(logs ? a.kind.slice(0, -5) : a.kind);
    sprite(ctx, sx, sy, zoom, logs ? log3dSprite(sp, o.state + 1, o.season, treeView(o), 2, false) : stumpSprite(sp, o.season, o.day, treeView(o)));
  },
};

/* ---- flowers and crops --------------------------------------------------------------------- */

const flower: Family = {
  id: 'flower', register: 'paint', ref: 4, splashy: true,
  about: 'The meadow\'s flowers by colour, four variants each, swaying.',
  list: () => FLOWER_COLOURS.map((c, i): Asset => ({
    family: 'flower', kind: c.name.toLowerCase().replace(/ /g, '_'), name: `${c.name} flower`, register: 'paint', style: 'flat', entry: 'flowerSprite', file: 'src/render/flowers.ts',
    views: 'none', states: [], variants: [0, 1, 2, 3].map((v) => ({ label: `variant ${v}`, set: { variant: v } })), motions: [frames('sway', 'sway', 5)], emissive: false, ref: 4, ...({ colour: i } as object),
  })),
  draw: (ctx, sx, sy, zoom, a, o) => {
    const s = flowerSprite((a as Asset & { colour: number }).colour, o.variant, o.motion === 'sway' ? o.frame - 2 : 0);
    ctx.drawImage(s.canvas, sx - s.ax * zoom, sy - s.ay * zoom, s.w * zoom, s.h * zoom);
  },
};

const crop: Family = {
  id: 'crop', register: 'paint', ref: 2,
  about: 'Crops in a field by stage of growth, a tile\'s bake at each turn of the camera and step of the sun (fieldBake).',
  list: () => Object.values(CROPS).map((c): Asset => ({
    family: 'crop', kind: c.id, name: c.name, register: 'paint', style: 'flat', entry: 'fieldBake', file: 'src/render/crops.ts', views: 'turns',
    states: states(['sown', 'sprouting', 'growing', 'ripe']), variants: [{ label: 'tended', set: { tended: true } }, { label: 'dormant', set: { dormant: true } }, { label: 'dormant, tended', set: { dormant: true, tended: true } }], motions: [frames('sun', 'the sun\'s steps', 8)], emissive: false, ref: 2,
  })),
  draw: (ctx, sx, sy, zoom, a, o) => {
    const c = CROPS[a.kind];
    const step = o.motion === 'sun' ? o.frame : 3;
    const b = fieldBake(c.id, o.state, c.colors[0], c.colors[1], !!o.dormant, !!o.tended, o.turn, step, zoom, 0);
    ctx.drawImage(b.canvas, sx - b.ax, sy - b.ay, b.w, b.h);
  },
};

/* ---- spells: each as its own sheet ------------------------------------------------------- */

const spell: Family = {
  id: 'spell', register: 'line', ref: 6,
  about: 'Every spell with a visual, through its cast, flight, impact and what lingers (spellSheet).',
  list: () => SPELLS.filter((s) => visualOf(s.id)).map((s): Asset => ({
    family: 'spell', kind: s.id, name: `${s.name} (${s.school})`, register: 'line', style: 'model', entry: 'spellSheet', file: `src/render/spells/${s.school}.ts`, views: 'facings',
    states: [], variants: [], motions: [frames('cast', 'the cast through', 10)], emissive: true, ref: 6,
  })),
  draw: () => {},
  whole: (a, o) => spellSheet({ spell: a.kind, facing: o.facing, frames: 10, zoom: 2, cols: 10, label: true, night: o.night > 0.5 }),
};

/* ---- scene-only families: catalogued, seen on the world strip ------------------------------ */

const sceneFamily = (id: string, about: string, file: string, kinds: Array<[string, string]>, ref: number): Family => ({
  id, register: 'paint', ref, about,
  list: () => kinds.map(([kind, name]): Asset => ({ family: id, kind, name, register: 'paint', style: 'scene', entry: 'Renderer (scene)', file, views: 'none', states: [], variants: [], motions: [], emissive: false, ref })),
  draw: () => {},
});

const MATERIALS: Array<[string, string]> = [['cobble', 'Cobble'], ['brick', 'Brick'], ['stone', 'Stone'], ['sandstone', 'Sandstone'], ['slate', 'Slate'], ['marble', 'Marble'], ['glass', 'Glass'], ['adobe', 'Adobe'], ['timber', 'Timber'], ['log', 'Log'], ['plank', 'Plank'], ['silver', 'Silver'], ['gold', 'Gold']];
const SCENE_FAMILIES: Family[] = [
  sceneFamily('masonry', 'Walls by material, drawn from the scene: see `world:cottage`.', 'src/render/masonry.ts', MATERIALS, 4),
  sceneFamily('roof', 'Roofs by covering, drawn from the scene: see `world:cottage`.', 'src/render/roofing.ts', [['thatch', 'Thatch'], ['slate', 'Slate'], ['tile', 'Tile'], ['shingle', 'Shingle']], 4),
  sceneFamily('floor', 'Floors, slabs and glass, drawn from the scene.', 'src/render/flooring.ts', [['plank', 'Plank'], ['slab', 'Slab'], ['concrete', 'Concrete'], ['leaded_glass', 'Leaded glass']], 4),
  sceneFamily('ground', 'The ground by terrain, drawn from the scene: see `world:terrains`.', 'src/render/renderer.ts', [['grass', 'Grass'], ['dirt', 'Dirt'], ['sand', 'Sand'], ['rock', 'Rock'], ['steppe', 'Steppe'], ['tundra', 'Tundra'], ['marsh', 'Marsh'], ['clay', 'Clay'], ['peat', 'Peat'], ['tar', 'Tar'], ['moss', 'Moss'], ['snow', 'Snow'], ['cobblestone', 'Cobblestone'], ['lawn', 'Lawn'], ['slabs', 'Slabs']], 2),
  sceneFamily('water', 'Sea, shore, springs, ponds, pools, falls and the aqueduct, drawn from the scene: see `world:shore` and tools/falls-shot.mjs.', 'src/render/water.ts, shore.ts, ponds.ts, pools.ts, falls.ts, aqueducts.ts', [['sea', 'Sea'], ['shore', 'Shore'], ['spring', 'Spring'], ['pond', 'Pond'], ['pool', 'Pool'], ['falls', 'Falls'], ['aqueduct', 'Aqueduct']], 1),
  sceneFamily('stone', 'Stones, outcrops and ore faces, drawn from the scene: see `world:rock`.', 'src/render/stones.ts, outcrops.ts', [['stones', 'Stones'], ['outcrop', 'Outcrop'], ['ore', 'Ore seam']], 4),
  sceneFamily('structure', 'Gates, piers, bridges, stairs, cellars and counters, drawn from the scene.', 'src/render/gates.ts, piers.ts, bridgekit.ts, stairing.ts, spiralkit.ts, cellar.ts, counter.ts', [['gate', 'Gate'], ['pier', 'Pier'], ['bridge', 'Bridge'], ['stair', 'Stair'], ['spiral', 'Spiral stair'], ['cellar', 'Cellar'], ['counter', 'Counter']], 4),
  sceneFamily('air', 'Smoke, dust, trails, ivy and moss, drawn from the scene.', 'src/render/smoke.ts, dust.ts, trails.ts, ivy.ts', [['smoke', 'Smoke'], ['dust', 'Dust'], ['trail', 'Trail'], ['ivy', 'Ivy'], ['moss', 'Moss']], 1),
];

/* ---- the registry ------------------------------------------------------------------------- */

export const FAMILIES: Family[] = [furniture, forge, rune, device, creature, player, portrait, tree, bush, stump, flower, crop, spell, ...SCENE_FAMILIES];
export const familyOf = (id: string): Family | undefined => FAMILIES.find((f) => f.id === id);

/** The kit and the beds drawn as the game draws them, not the old models (`kitSync`, `denSync`). */
export function syncKit(): void {
  kitSync(true);
  denSync(true);
}

/** `furnitureDef` for the footprint of a piece the family says has one. */
export const footprintOf = (a: Asset): [number, number] | undefined => (a.family === 'furniture' ? [furnitureDef(a.kind).w, furnitureDef(a.kind).h] : a.footprint);
export type { PieceView };
