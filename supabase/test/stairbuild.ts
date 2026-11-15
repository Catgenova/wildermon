/**
 * A staircase or a ladder planned on storey 2 is built from storey 1, where it is climbed from.
 *
 * Reported on Vinyard: "There's no option to work on that planned staircase". Southern Greenhouse's only way up is a
 * timbercraft single staircase on storey 2, planned from storey 1 (`stairsUpEntries`) and never built. Storey 1's
 * menu on its tile offered the flooring under it and nothing of the staircase over it, and storey 2 cannot be stood
 * on until the staircase is built. Storey 1's menu on the tile now has "Build <it> up (storey 2)" (`wayUpPlanned`),
 * its target naming storey 2, which `build_floor` and the island's `build_refusal` both read.
 *
 * Here: a single, a wide and a spiral staircase and a ladder, each planned on storey 2 of a two-storey house over
 * a finished storey 1. For each, from storey 1 at its foot: the row offered (on Auto, worked on storey 1, and with
 * storey 1 pinned), built to the end by the browser, and the target the row sends refused by nothing and built to
 * the end by the island, the builder still on storey 1. From storey 2 beside it (pinned), its own Build row, built
 * on both sides. A floor planned on storey 2 is not offered from storey 1, nor a staircase once it is finished.
 */
import type { Target } from '../../src/game/actions';
import { BUILD_ACTION_BY_ID } from '../../src/game/buildActions';
import { floorBill, floorName, floorNameOf, isDone, SPIRAL, type BuildingsJSON, type FloorKind, type FloorTile, type StairHand } from '../../src/game/building';
import { Game } from '../../src/game/game';
import type { MenuItem } from '../../src/ui/contextmenu';
import { UI } from '../../src/ui/ui';
import { TileType } from '../../src/world/tiles';
import { psql } from './harness';
import { SKILL_GATES } from '../../src/game/skillgates';

/** Carpentry and masonry enough for every material and floor type (`craftgates.ts`): this is about the stairs, not their gates. */
const BUILT = (skill: string): number => Math.max(...SKILL_GATES.filter((g) => (g.kind === 'material' || g.kind === 'floor') && g.skill === skill).map((g) => g.level));

let bad = 0;
let good = 0;
const check = (what: string, ok: boolean, detail = ''): void => {
  if (ok) good++;
  else bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/*
 * On the Hoarding island, in its north-east, ground flat at 30: a house of 43..47 by 10..13, two storeys, worked on
 * storey 1, every tile of storey 1 floored in plank. The way up planned on storey 2 at 45, 11, climbed from the
 * south: its foot is 45, 12, where the builder stands. Storey 2 is floored round it at 44..46, 10 and 44, 11 and
 * 46, 11, finished, and a plank floor is planned at 47, 11.
 */
const H = 30;
const ID = 9311;
const NAME = 'Stairbuild house';
const X0 = 43, X1 = 47, Y0 = 10, Y1 = 13;
const SX = 45, SY = 11;
const FOOT = { x: SX + 0.5, y: SY + 1.5 };
const UPSTAIRS = { x: SX - 0.5, y: SY + 0.5 };
const DONE_UP: Array<[number, number]> = [[44, 10], [45, 10], [46, 10], [44, 11], [46, 11]];
const PLANNED_UP: [number, number] = [47, 11];

interface Way { name: string; kind: FloorKind; material: string; hand?: StairHand; facing?: 'n' | 'e' | 's' | 'w'; tool: string }
const WAYS: Way[] = [
  { name: 'single staircase', kind: 'stairs', material: 'timbercraft', hand: 'l', facing: 's', tool: 'mallet' },
  { name: 'wide staircase', kind: 'stairs', material: 'plank', facing: 's', tool: 'mallet' },
  { name: 'spiral staircase', kind: 'stairs', material: 'stone_brick', hand: SPIRAL, tool: 'trowel' },
  { name: 'ladder', kind: 'ladder', material: 'plank', facing: 's', tool: 'mallet' },
];
const billOf = (w: Way) => floorBill(w.material, w.kind, 'hip', w.hand ?? null);
const done = { needed: {}, total: {} };

function house(w: Way | null): Game {
  const g = Game.create(9311, 64);
  g.skills.values.set('carpentry', BUILT('carpentry'));
  g.skills.values.set('masonry', BUILT('masonry'));
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  for (let y = 4; y < 20; y++) for (let x = 36; x < 54; x++) { g.world.setHeight(x, y, H); g.world.setTile(x, y, TileType.PackedDirt, 0); }
  const tiles: string[] = [];
  const floors: Array<Partial<FloorTile>> = [];
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    tiles.push(`${x},${y}`);
    floors.push({ building: ID, level: 0, x, y, kind: 'floor', material: 'plank', ...done });
  }
  for (const [x, y] of DONE_UP) floors.push({ building: ID, level: 1, x, y, kind: 'floor', material: 'plank', ...done });
  const plank = floorBill('plank');
  floors.push({ building: ID, level: 1, x: PLANNED_UP[0], y: PLANNED_UP[1], kind: 'floor', material: 'plank', needed: { ...plank.needed }, total: { ...plank.total } });
  if (w) {
    const bill = billOf(w);
    floors.push({ building: ID, level: 1, x: SX, y: SY, kind: w.kind, material: w.material, hand: w.hand, facing: w.facing,
      needed: { ...bill.needed }, total: { ...bill.total } });
  }
  g.buildings.sawIsland({ nextId: ID + 1, list: [{ id: ID, name: NAME, levels: 2, workLevel: 0, tiles }], walls: [], floors, cellars: [], columns: [], noPlan: [] } as unknown as BuildingsJSON as never);
  for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
  g.player.x = FOOT.x;
  g.player.y = FOOT.y;
  g.player.level = 0;
  g.settings.viewLevel = null;
  return g;
}

/** What a builder of `w` carries: its tool and its bill. */
function kit(g: Game, w: Way): void {
  for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
  g.inventory.add(w.tool, { ql: 50 });
  for (const [id, n] of Object.entries(billOf(w).needed)) if (n > 0) g.inventory.add(id, { ql: 50, count: n });
}

/** The tile's building rows, as the window lists them: `storey` for a pinned storey's own menu over the ground. */
function rows(g: Game, x: number, y: number, storey?: number): MenuItem[] {
  const ui = Object.assign(Object.create(UI.prototype), { game: g, startPlacingStairs() {} });
  const pick = { x, y, cx: x, cy: y, wx: x + 0.5, wy: y + 0.5, level: storey };
  return (UI.prototype as unknown as { buildingEntries(this: unknown, pick: unknown, storey?: number): MenuItem[] }).buildingEntries.call(ui, pick, storey);
}
/** The target a row asks for when it is chosen, caught on its way to the game. */
function asked(g: Game, row: MenuItem | undefined): Target | undefined {
  // A piece of many goes is a row of counts (`buildRow`): its last, every go to the end.
  const go = row?.children?.at(-1) ?? row;
  if (!go?.onSelect) return undefined;
  let got: Target | undefined;
  const was = g.requestAction;
  g.requestAction = ((_def: unknown, t: Target) => { got = t; }) as typeof g.requestAction;
  go.onSelect();
  g.requestAction = was;
  return got;
}
const build = BUILD_ACTION_BY_ID.get('build_floor')!;
/** The browser's door, a go at a time, to the end: the refusal that stopped it, or null. */
function buildAll(g: Game, t: Target): string | null {
  for (let i = 0; i < 80; i++) {
    const f = g.buildings.floor(1, SX, SY);
    if (f && isDone(f)) return null;
    const why = build.check?.(t, g) ?? null;
    if (why) return why;
    build.perform(t, g);
  }
  return 'did not finish';
}

/* ---- the browser ---------------------------------------------------------------------------------- */

interface Found { below?: Target; above?: Target }
const found = new Map<string, Found>();
for (const w of WAYS) {
  const label = `Build ${floorNameOf(w.kind, w.hand)} up (storey 2)`;
  const g = house(w);
  kit(g, w);
  const auto = rows(g, SX, SY).find((r) => r.label.startsWith(label));
  check(`${w.name}: storey 1's menu on its tile, on Auto worked on storey 1, offers "${label}"`, !!auto && !auto.disabled,
    auto ? `${auto.label}${auto.disabled ? ` [${auto.hint}]` : ''}` : rows(g, SX, SY).map((r) => r.label).join(' | '));
  g.settings.viewLevel = 0;
  const pinned = rows(g, SX, SY).find((r) => r.label.startsWith(label));
  check(`${w.name}: and with storey 1 pinned`, !!pinned && !pinned.disabled, pinned ? pinned.label : 'none');
  const t = asked(g, pinned);
  check(`${w.name}: the row asks for storey 2's slot on its tile`, !!t && t.kind === 'tile' && t.x === SX && t.y === SY && t.level === 1, JSON.stringify(t));
  if (t) found.set(w.name, { below: t });
  const why = t ? buildAll(g, t) : 'no target';
  check(`${w.name}: built to the end from its foot on storey 1`, why === null && isDone(g.buildings.floor(1, SX, SY)!) && g.player.level === 0,
    `${why ?? ''} ${g.log[g.log.length - 1]?.text ?? ''}`);
  check(`${w.name}: finished, no Build up row on storey 1`, !rows(g, SX, SY).some((r) => r.label.startsWith('Build')),
    rows(g, SX, SY).filter((r) => r.label.startsWith('Build')).map((r) => r.label).join(' | '));

  // From storey 2 beside it, pinned there: its own Build row, as it always was.
  const up = house(w);
  kit(up, w);
  up.player.x = UPSTAIRS.x;
  up.player.y = UPSTAIRS.y;
  up.player.level = 1;
  up.settings.viewLevel = 1;
  const own = `Build ${floorName(up.buildings.floor(1, SX, SY)!)} · needs`;
  const row = rows(up, SX, SY, 1).find((r) => r.label.startsWith(own));
  const ta = asked(up, row);
  check(`${w.name}: storey 2's menu on it offers "${own} …"`, !!row && !row.disabled && ta?.kind === 'tile' && ta.level === 1, row?.label ?? 'none');
  if (ta) found.get(w.name)!.above = ta;
  const whyUp = ta ? buildAll(up, ta) : 'no target';
  check(`${w.name}: built to the end from storey 2`, whyUp === null && isDone(up.buildings.floor(1, SX, SY)!), whyUp ?? '');
}

{
  // A floor planned on storey 2 is storey 2's: nothing of it on storey 1's menu, on Auto or pinned.
  const g = house(null);
  g.inventory.add('mallet', { ql: 50 });
  g.inventory.add('plank', { ql: 50, count: 20 });
  const [px, py] = PLANNED_UP;
  const auto = rows(g, px, py).filter((r) => r.label.startsWith('Build')).map((r) => r.label);
  g.settings.viewLevel = 0;
  const pinned = rows(g, px, py).filter((r) => r.label.startsWith('Build')).map((r) => r.label);
  check('a floor planned on storey 2: no Build row on storey 1 under it', !auto.length && !pinned.length, [...auto, ...pinned].join(' | '));
  g.settings.viewLevel = 1;
  check('and on storey 2 its Build row', rows(g, px, py, 1).some((r) => r.label.startsWith('Build floor')),
    rows(g, px, py, 1).map((r) => r.label).join(' | '));
}

/* ---- the island ----------------------------------------------------------------------------------- */

const jt = (t: Target): string => `${q(JSON.stringify(t))}::jsonb`;
const sqlBill = (w: Way): string => `floor_bill(${q(w.material)}, ${q(w.kind)}, null::text, ${w.hand ? q(w.hand) : 'null::text'})`;
/** In a block with `w`, `me`, `v_why`, `v_i` and `v_id` declared: the builder at (x, y) on `level` with `way`'s tool and bill, then every go of `t` to the end. */
const goes = (tag: string, way: Way, t: Target, at: { x: number; y: number }, level: number): string => `
  update player set body_at = now(), x = ${at.x}, y = ${at.y}, level = ${level}, level_h = null, act = null, act_queue = '[]'::jsonb, aboard = null,
         stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'::jsonb)
   where world_id = w and uid = me;
  delete from item where world_id = w and holder = 'player' and holder_uid = me;
  perform give(w, me, ${q(way.tool)}, 1, 50);
  for v_id, v_i in select e.key, (e.value)::int from jsonb_each_text(${sqlBill(way)}) e where (e.value)::int > 0 loop
    perform give(w, me, v_id, v_i, 50);
  end loop;
  insert into said values (${q(`${tag}:refused`)}, coalesce(act_refusal(w, me, 'build_floor', ${jt(t)}), 'none'));
  for v_i in 1..80 loop
    exit when (select bill_done(f.needed) from floor_tile f where f.world_id = w and f.level = 1 and f.x = ${SX} and f.y = ${SY});
    v_why := build_refusal(w, me, 'build_floor', ${jt(t)});
    if v_why is not null then insert into said values (${q(`${tag}:stopped`)}, v_why); exit; end if;
    perform perform_building(w, me, 'build_floor', ${jt(t)});
  end loop;
  insert into said select ${q(`${tag}:built`)}, bill_done(f.needed)::text from floor_tile f where f.world_id = w and f.level = 1 and f.x = ${SX} and f.y = ${SY};
  insert into said select ${q(`${tag}:level`)}, level::text from player where world_id = w and uid = me;`;

const ways = WAYS.filter((w) => found.get(w.name)?.below && found.get(w.name)?.above).map((w) => {
  const f = found.get(w.name)!;
  return `
  delete from floor_tile where world_id = w and level = 1 and x = ${SX} and y = ${SY};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, hand, needed, total)
    values (w, 1, ${SX}, ${SY}, ${ID}, ${q(w.material)}, ${q(w.kind)}, ${w.facing ? q(w.facing) : 'null'}, ${w.hand ? q(w.hand) : 'null'}, ${sqlBill(w)}, ${sqlBill(w)});
  insert into said values (${q(`${w.name}:bill`)}, ${sqlBill(w)}::text);
  ${goes(`${w.name}:below`, w, f.below!, FOOT, 0)}
  update floor_tile set needed = total where world_id = w and level = 1 and x = ${SX} and y = ${SY};
  ${goes(`${w.name}:above`, w, f.above!, UPSTAIRS, 1)}`;
}).join('\n');

const out = psql(`begin;
create temp table said (k text, v text) on commit drop;
do $b$
declare w uuid; me uuid; v_why text; v_i int; v_id text;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  insert into skill (world_id, uid, id, value) values (w, me, 'carpentry', ${BUILT('carpentry')}), (w, me, 'masonry', ${BUILT('masonry')})
    on conflict (world_id, uid, id) do update set value = greatest(skill.value, excluded.value);
  delete from building b where b.world_id = w and (b.id = ${ID} or exists (select 1 from building_tile bt
    where bt.world_id = w and bt.building = b.id and bt.x between 36 and 54 and bt.y between 4 and 20));
  delete from deed where world_id = w and x between 16 and 74 and y between 0 and 40;
  delete from placed where world_id = w and x between 36 and 54 and y between 4 and 20;
  delete from crate where world_id = w and x between 36 and 54 and y between 4 and 20;
  for gx in 36..54 loop for gy in 4..20 loop
    perform land_set_height(w, gx, gy, ${H});
    if gx < 54 and gy < 20 then perform land_set_tile(w, gx, gy, tile_id('Packed dirt')); end if;
  end loop; end loop;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${ID}, ${q(NAME)}, 2, 0, me);
  insert into building_tile (world_id, building, x, y)
    select w, ${ID}, gx, gy from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    select w, 0, gx, gy, ${ID}, 'plank', 'floor', '{}'::jsonb, '{}'::jsonb from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
    ${DONE_UP.map(([x, y]) => `(w, 1, ${x}, ${y}, ${ID}, 'plank', 'floor', '{}'::jsonb, '{}'::jsonb)`).join(', ')};
  ${ways}
end $b$;
select coalesce(string_agg(k || '=' || coalesce(v, 'null'), E'\\n~~\\n' order by k), '') from said;
rollback;`);
const island = new Map(out.split('\n~~\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

for (const w of WAYS) {
  const theirs = JSON.parse(island.get(`${w.name}:bill`) ?? '{}') as Record<string, number>;
  const mine = billOf(w).needed;
  check(`${w.name}: the same bill on both sides`, JSON.stringify(Object.entries(mine).sort()) === JSON.stringify(Object.entries(theirs).sort()),
    `${JSON.stringify(mine)} here, ${JSON.stringify(theirs)} there`);
  for (const [side, from] of [['below', 'storey 1 at its foot'], ['above', 'storey 2 beside it']] as const) {
    const refused = island.get(`${w.name}:${side}:refused`);
    const stopped = island.get(`${w.name}:${side}:stopped`);
    const built = island.get(`${w.name}:${side}:built`);
    const level = island.get(`${w.name}:${side}:level`);
    check(`${w.name}: the island takes the row's ask from ${from}`, refused === 'none', refused ?? 'not asked');
    check(`${w.name}: and builds it to the end, the builder still on storey ${side === 'below' ? 1 : 2}`,
      built === 'true' && !stopped && level === (side === 'below' ? '0' : '1'), `built ${built}, stopped ${stopped ?? '-'}, level ${level}`);
  }
}

console.log(`a staircase or a ladder planned on storey 2, built from storey 1 — ${good} of ${good + bad}`);
if (bad) process.exit(1);
