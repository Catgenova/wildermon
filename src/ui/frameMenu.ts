/**
 * The building menu's rows for jetties, balconies, railings round a flat roof,
 * and columns (`../game/frame.ts`). `buildingEntries` asks for them on every
 * tile it lists building work on: a tile of a building gets its columns and
 * its terrace; a tile out past one gets the jetty that could go there, or the
 * one that is there, on the storey being worked.
 */
import type { Bill } from '../game/building';
import { buildRow } from './buildCounts';
import { ACTION_BY_ID, type ActionDef, type Target } from '../game/actions';
import { materialName } from '../game/buildActions';
import {
  columnBill,
  describeNeeds,
  floorBill,
  FLOOR_KIND_NAMES,
  floorKind,
  isDone,
  MATERIAL_BY_ID,
  MATERIALS,
  OPPOSITE_SIDE,
  OUTSIDE_STAIR_LEVEL,
  SINGLE_STAIRS_NAME,
  takesAs,
  progressOf,
  ROOF_SHAPES,
  roofShapeOf,
  SIDE_NAMES,
  wallBill,
  WALL_TYPE_BY_ID,
  WALL_TYPES,
  workLevel,
  type Building,
  type RoofShape,
  type Side,
  type StairHand,
} from '../game/building';
import { cornerName } from '../game/frame';
import { fitsMaterial, hiddenDoorIronWords, hiddenDoorWants, planHiddenDoor } from '../game/gates';
import type { Game } from '../game/game';
import { nearestSide, type Pick } from '../render/renderer';
import type { MenuItem } from './contextmenu';

type TileTarget = Extract<Target, { kind: 'tile' }>;

const act = (id: string): ActionDef => {
  const def = ACTION_BY_ID.get(id);
  if (!def) throw new Error(`unknown building action ${id}`);
  return def;
};

/** One row for one job on one target, disabled with the reason when the job would be refused. */
const entry = (g: Game, def: ActionDef, target: Target, label = def.label): MenuItem => {
  const reason = def.check?.(target, g) ?? null;
  return { label, hint: reason ?? undefined, disabled: !!reason, onSelect: () => g.requestAction(def, target) };
};
/** Building a planned piece, a number of goes at a time (`buildCounts.ts`). */
const build = (g: Game, def: ActionDef, target: Target, label: string, bill: Bill): MenuItem => buildRow(g, def, target, label, bill, def.check?.(target, g) ?? null);

/** A row that opens onto the twelve materials, each with what it costs. */
const materials = (g: Game, def: ActionDef, target: TileTarget, label: string, bill: (m: string) => Parameters<typeof describeNeeds>[0]): MenuItem => {
  const probe = def.check?.({ ...target, material: 'log', wallType: target.wallType ?? 'solid' }, g) ?? null;
  // Refused whatever it is made of: say why on the row itself.
  if (probe && !probe.includes('too heavy') && !probe.startsWith('Choose')) return { label, hint: probe, disabled: true };
  // A material laid as only some things (`onlyRefusal`) is not offered for the rest at all.
  const as = def.id === 'plan_column' ? { column: true } : def.id === 'plan_floor' ? { floor: target.floorKind ?? 'floor' } : { wall: target.wallType };
  return {
    label,
    children: MATERIALS.filter((m) => takesAs(m, as)).map((m) => {
      const t: TileTarget = { ...target, material: m.id };
      const why = def.check?.(t, g) ?? null;
      return { label: m.name, note: describeNeeds(bill(m.id), materialName), hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(def, t) };
    }),
  };
};

/**
 * The roof planned over a jetty of a building that has no roof yet is planned
 * in a shape as well as a material -- gabled, hipped or flat, and a flat one
 * is a terrace -- so the first tile of it asks which. After that the shape is
 * the building's. (The building's own first roof tile asks the same, with
 * glass among its materials: `UI` in `ui.ts`.)
 */
function roofShapeMenu(g: Game, b: Building, target: TileTarget): MenuItem[] | null {
  if (b.roof) return null;
  const plan = act('plan_floor');
  return ROOF_SHAPES.map((r) => ({
    label: r.name,
    note: r.note,
    children: MATERIALS.filter((m) => takesAs(m, { floor: 'roof' })).map((m) => {
      const t: TileTarget = { ...target, floorKind: 'roof', roofShape: r.id as RoofShape, material: m.id };
      const why = plan.check?.(t, g) ?? null;
      return { label: m.name, note: describeNeeds(floorBill(m.id, 'roof', r.id), materialName), hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(plan, t) };
    }),
  }));
}

/** Rows for the column on the corner nearest the click, on the storey the job names (`level`), which they say. */
function columnRows(g: Game, b: Building, base: TileTarget): MenuItem[] {
  const level = base.level ?? workLevel(b);
  const corner = cornerName(base, base.cx, base.cy);
  const where = `${corner} corner, storey ${level + 1}`;
  const c = g.buildings.column(level, base.cx, base.cy);
  if (c) {
    const out: MenuItem[] = [];
    if (!isDone(c)) out.push(entry(g, act('build_column'), base, `Build column (${where}) · needs ${describeNeeds(c, materialName)}`));
    out.push(entry(g, act('remove_column'), base, `Remove column (${where})`));
    return out;
  }
  return [materials(g, act('plan_column'), base, `Plan column (${where})`, (m) => columnBill(m))];
}

/** Rows for a railing round a flat roof, on the side nearest the click. */
function terraceRows(g: Game, b: Building, pick: Pick, base: TileTarget): MenuItem[] {
  if (roofShapeOf(b) !== 'flat' || !g.buildings.roofAt(b.levels, base.x, base.y)) return [];
  const side = nearestSide(pick.x, pick.y, pick.wx, pick.wy);
  const t: TileTarget = { ...base, side, terrace: true };
  const standing = g.buildings.wall(b.levels, base.x, base.y, side);
  if (standing) {
    const out: MenuItem[] = [];
    if (!isDone(standing)) out.push(build(g, act('build_wall'), t, `Build roof railing (${SIDE_NAMES[side]}) · needs ${describeNeeds(standing, materialName)}`, standing));
    out.push(entry(g, act('remove_wall'), t, `Remove roof railing (${SIDE_NAMES[side]})`));
    return out;
  }
  return [materials(g, act('plan_wall'), { ...t, wallType: 'railing' }, `Plan roof railing (${SIDE_NAMES[side]})`, (m) => wallBill(m, 'railing'))];
}

/** The rows for a tile of a building: its columns, and the railing round its roof. */
export function frameFootprintEntries(g: Game, pick: Pick, b: Building): MenuItem[] {
  const base: TileTarget = { kind: 'tile', x: pick.x, y: pick.y, cx: pick.cx, cy: pick.cy, level: workLevel(b) };
  return [...columnRows(g, b, base), ...terraceRows(g, b, pick, base)];
}

/** Starts placing an outside staircase on a tile for a building: Q and E turn it (`UI.startPlacingStairs`). */
export type PlaceStairs = (base: TileTarget, level: number, material: string, side: Side, hand?: StairHand) => void;

/**
 * The rows for an outside staircase of a building on a tile out past its
 * footprint (`outsideStairReason`): planning one, wide or single, its head
 * turned to the building to start with, and Q and E turning it; or building
 * and taking out the one there.
 */
function outsideStairRows(g: Game, b: Building, base: TileTarget, place?: PlaceStairs): MenuItem[] {
  const bld = g.buildings;
  const storey = OUTSIDE_STAIR_LEVEL + 1;
  const t: TileTarget = { ...base, level: OUTSIDE_STAIR_LEVEL };
  const there = bld.outsideStair(t.x, t.y);
  if (there && there.building === b.id) {
    const what = there.hand ? `outside ${SINGLE_STAIRS_NAME}` : 'outside staircase';
    const rows: MenuItem[] = [];
    if (!isDone(there)) rows.push(build(g, act('build_floor'), t, `Build ${what} · needs ${describeNeeds(there, materialName)}`, there));
    rows.push(entry(g, act('remove_floor'), t, `Remove ${what}`));
    return rows;
  }
  if (bld.jettyAt(t.x, t.y) || !place) return [];
  // Its head against the building: climbed from the side away from it.
  const head = (['n', 'e', 's', 'w'] as Side[]).find((side) => {
    const [dx, dy] = side === 'n' ? [0, -1] : side === 's' ? [0, 1] : side === 'w' ? [-1, 0] : [1, 0];
    return bld.tileIndex.get(`${t.x + dx},${t.y + dy}`) === b.id;
  }) ?? 'n';
  const side = OPPOSITE_SIDE[head];
  const plan = act('plan_floor');
  const rows: MenuItem[] = [];
  for (const hand of [undefined, 'l'] as Array<StairHand | undefined>) {
    const label = `Plan outside ${hand ? SINGLE_STAIRS_NAME : 'staircase'} (storey ${storey})`;
    const asked: TileTarget = { ...t, floorKind: 'stairs', side, ...(hand ? { hand } : {}) };
    const probe = plan.check?.({ ...asked, material: 'log' }, g) ?? null;
    if (probe) {
      rows.push({ label, hint: probe, disabled: true });
      continue;
    }
    rows.push({
      label,
      children: MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' })).map((m) => {
        const why = plan.check?.({ ...asked, material: m.id }, g) ?? null;
        return {
          label: m.name,
          note: `${describeNeeds(floorBill(m.id, 'stairs', undefined, hand), materialName)} · Q/E rotate`,
          hint: why ?? undefined,
          disabled: !!why,
          onSelect: () => place(t, OUTSIDE_STAIR_LEVEL, m.id, side, hand),
        };
      }),
    });
  }
  return rows;
}

/**
 * The rows for a tile out past every footprint: for each building beside it
 * that has a storey above the ground, or whose jetty is already there, the
 * jetty's floor, its walls and railings, its columns and the roof over it, on
 * the storey being worked; and its outside staircase (`outsideStairRows`).
 */
export function frameJettyEntries(g: Game, pick: Pick, place?: PlaceStairs): MenuItem[] {
  const bld = g.buildings;
  const { x, y } = pick;
  const hosts: Building[] = [];
  const there = bld.jettyAt(x, y);
  if (there) hosts.push(there);
  else {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const b = bld.buildingAt(x + dx, y + dy);
      if (b && b.levels > 1 && !hosts.includes(b)) hosts.push(b);
    }
  }
  const out: MenuItem[] = [];
  for (const b of hosts) {
    // A jetty is a storey above the ground's: worked from the ground floor, the rows are for the storey over it.
    const level = b.levels > 1 ? Math.max(1, workLevel(b)) : workLevel(b);
    const base: TileTarget = { kind: 'tile', x, y, cx: pick.cx, cy: pick.cy, buildingId: b.id, level };
    const stairs = outsideStairRows(g, b, base, place);
    const stair = bld.outsideStair(x, y);
    const ownStair = !!stair && stair.building === b.id;
    // On its own storey the tile is its outside staircase and nothing else: no jetty is floored there too.
    if (ownStair && level === OUTSIDE_STAIR_LEVEL) {
      out.push({ label: `Outside staircase of ${b.name} (storey ${OUTSIDE_STAIR_LEVEL + 1})`, children: stairs });
      continue;
    }
    const rows: MenuItem[] = [];
    const floor = bld.floor(level, x, y);
    if (floor && floor.building === b.id && floorKind(floor) !== 'stairs') {
      const what = FLOOR_KIND_NAMES[floorKind(floor)];
      if (!isDone(floor)) rows.push(build(g, act('build_floor'), base, `Build jetty ${what} · needs ${describeNeeds(floor, materialName)}`, floor));
      rows.push(entry(g, act('remove_floor'), base, `Remove jetty ${what}`));
      // Its walls and railings, on the side nearest the click.
      const side = nearestSide(x, y, pick.wx, pick.wy);
      const withSide: TileTarget = { ...base, side };
      const wall = bld.wall(level, x, y, side);
      if (wall) {
        const name = WALL_TYPE_BY_ID.get(wall.type)?.name.toLowerCase() ?? 'wall';
        if (!isDone(wall)) rows.push(build(g, act('build_wall'), withSide, `Build ${name} (${SIDE_NAMES[side]}) · needs ${describeNeeds(wall, materialName)}`, wall));
        rows.push(entry(g, act('remove_wall'), withSide, `Remove ${name} (${SIDE_NAMES[side]})`));
      } else {
        const plan = act('plan_wall');
        const probe = plan.check?.({ ...withSide, wallType: 'railing', material: 'log' }, g) ?? null;
        if (probe && !probe.includes('too heavy')) rows.push({ label: `Plan wall or railing (${SIDE_NAMES[side]})`, hint: probe, disabled: true });
        else {
          rows.push({
            label: `Plan wall or railing (${SIDE_NAMES[side]})`,
            children: WALL_TYPES.filter((wt) => !wt.standalone).map((wt) => ({
              label: wt.name,
              // gates: a portcullis only in stone or brick, and a hidden door asked for with a solid wall's plan, its iron in hand (`gates.ts`).
              children: MATERIALS.filter((m) => fitsMaterial(wt.id, m) && takesAs(m, { wall: wt.id })).map((m) => {
                const hidden = wt.id === 'hidden_door';
                const t: TileTarget = { ...withSide, wallType: hidden ? 'solid' : wt.id, material: m.id };
                const why = (hidden ? hiddenDoorWants(g) : null) ?? plan.check?.(t, g) ?? null;
                return {
                  label: m.name,
                  note: describeNeeds(wallBill(m.id, wt.id), materialName) + (hidden ? `, and ${hiddenDoorIronWords()} as it is planned` : ''),
                  hint: why ?? undefined,
                  disabled: !!why,
                  onSelect: () => (hidden ? planHiddenDoor(g, plan, { ...withSide, material: m.id }) : g.requestAction(plan, t)),
                };
              }),
            })),
          });
        }
      }
      rows.push(...columnRows(g, b, base));
    } else {
      rows.push(materials(g, act('plan_floor'), { ...base, floorKind: 'floor' }, `Plan jetty floor (storey ${level + 1})`, (m) => floorBill(m)));
    }
    // And the roof over it, when it is a jetty of the top storey.
    const top = bld.floor(b.levels - 1, x, y);
    if (top && top.building === b.id) {
      const roof = bld.floor(b.levels, x, y);
      const roofTarget: TileTarget = { ...base, floorKind: 'roof' };
      if (roof) {
        if (!isDone(roof)) rows.push(build(g, act('build_floor'), roofTarget, `Build jetty roof · needs ${describeNeeds(roof, materialName)}`, roof));
        rows.push(entry(g, act('remove_floor'), roofTarget, 'Remove jetty roof'));
      } else {
        const shapes = roofShapeMenu(g, b, roofTarget);
        if (shapes) rows.push({ label: 'Plan jetty roof', children: shapes });
        else rows.push(materials(g, act('plan_floor'), roofTarget, 'Plan jetty roof', (m) => floorBill(m, 'roof', roofShapeOf(b))));
      }
    }
    out.push(hosts.length > 1 ? { label: `${b.name}'s jetty`, children: rows } : { label: `Jetty of ${b.name} (storey ${level + 1})`, children: rows });
    // And its outside staircase, planned or standing, beside the jetty rather than in it.
    if (stairs.length) {
      if (hosts.length > 1 || ownStair) out.push({ label: `Outside staircase of ${b.name} (storey ${OUTSIDE_STAIR_LEVEL + 1})`, children: stairs });
      else out.push(...stairs);
    }
  }
  return out;
}

/** "plank", "· 40% built": a bill's stuff and how far it has gone. */
const stuffOf = (id: string): string => MATERIAL_BY_ID.get(id)?.name.toLowerCase() ?? id;
const built = (b: Parameters<typeof isDone>[0]): string => (isDone(b) ? '' : ` · ${Math.round(progressOf(b) * 100)}% built`);

/**
 * What the pointer says over a tile, for this batch: out past a footprint the
 * jetty there, its floor, the wall or railing on the side nearest the pointer
 * and the roof over it; and on any tile the column on the corner nearest it.
 */
export function frameHoverLines(g: Game, pick: Pick): string[] {
  const bld = g.buildings;
  const { x, y } = pick;
  const out: string[] = [];
  const host = bld.buildingAt(x, y) ? undefined : bld.jettyAt(x, y);
  if (host) {
    // Every storey floored out over the tile, from the lowest: a jetty open to its storey, or a balcony shut off from it.
    const side = nearestSide(x, y, pick.wx, pick.wy);
    for (let level = 1; level < host.levels; level++) {
      const f = bld.floor(level, x, y);
      if (!f || f.building !== host.id) continue;
      const what = floorKind(f) === 'stairs' ? 'outside staircase' : bld.storeyArea(host, level).has(`${x},${y}`) ? 'jetty' : 'balcony';
      out.push(`${host.name}'s ${what} · storey ${level + 1} · ${stuffOf(f.material)} ${FLOOR_KIND_NAMES[floorKind(f)]}${built(f)}`);
      const wall = bld.wall(level, x, y, side);
      if (wall) out.push(`${SIDE_NAMES[side]} wall: ${WALL_TYPE_BY_ID.get(wall.type)?.name.toLowerCase() ?? wall.type} ${stuffOf(wall.material)}${built(wall)}`);
      else out.push(`${SIDE_NAMES[side]} side: no wall`);
    }
    const roof = bld.floor(host.levels, x, y);
    if (roof && roof.building === host.id) out.push(`roof${built(roof)}`);
  }
  // The column on the nearest corner: on the storey being worked, or the lowest one with a column there.
  if (bld.columns.size && bld.hasColumnAt(pick.cx, pick.cy)) {
    const b = bld.buildingAt(x, y) ?? host;
    let c = b ? bld.column(workLevel(b), pick.cx, pick.cy) : undefined;
    for (let l = 0; !c && l <= (b?.levels ?? 1); l++) c = bld.column(l, pick.cx, pick.cy);
    if (c) {
      const of = bld.list.get(c.building);
      const storey = of && of.levels > 1 ? `, storey ${c.level + 1}` : '';
      out.push(`Column, ${cornerName({ x, y }, pick.cx, pick.cy)} corner${storey}: ${stuffOf(c.material)}${built(c)}`);
    }
  }
  return out;
}
