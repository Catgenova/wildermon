/**
 * Obsidian gear and obsidian glass, held to their rules on both sides.
 *
 *   * obsidian: the same raw item on both sides, and made or found by nothing -- no recipe, no forage, botanizing,
 *     mining, panning, bush or hoard gives it, so a monster killed on Volcano Isle is the only way to it;
 *   * the obsidian set: five pieces, one to each place armour is worn, the class between plate and scale in soak and
 *     lighter than plate, the best against cuts and burns and the worst against crushing; each piece's recipe the
 *     same on both sides, riveted at an anvil with a hammer (refused without one, in the same words), and made on
 *     the island;
 *   * the knapped tools and weapons: each recipe the same on both sides, made on the island Obsidian; Obsidian the
 *     keenest edge and the truest bite, and the fastest wear, on both sides, worked out on the island as the browser
 *     works it; improved with obsidian at stonecutting on both sides;
 *   * obsidian glass: its bill, tool, skill, storeys and heft the same on both sides; a solid wall or a floor and
 *     nothing else, refused in the same words; seen through; and planned and built on the island as a wall, a floor
 *     and a second storey over it.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
// First, so the rules load in the order the game loads them: building and items lean on each other.
import { ACTIONS } from '../../src/game/actions';
import { floorBill, MATERIAL_BY_ID as BUILD_MATERIAL_BY_ID, OBSIDIAN_GLASS, OBSIDIAN_GLASS_OPACITY, onlyRefusal, onlySaid, wallBill, WALL_TYPES, storeySkill } from '../../src/game/building';
import { ARMOUR, ARMOUR_CLASSES, ARMOUR_SLOTS, OBSIDIAN_PIECES, WEAPON_BY_ID, isWeapon } from '../../src/game/gear';
import { ARMOUR_VS, armourSays } from '../../src/game/fight';
import { Game } from '../../src/game/game';
import { ITEM_DEFS } from '../../src/game/items';
import { improvable } from '../../src/game/improve';
import { MATERIALS, MATERIAL_BY_ID, OBSIDIAN, OBSIDIAN_KEEN, OBSIDIAN_MATERIAL, OBSIDIAN_WEAR, workingQl } from '../../src/game/materials';
import { KNAP_DIFFICULTY, KNAP_PER, KNAPPED, knapRecipeId, OBSIDIAN_ARMOUR, RECIPE_BY_ID, RECIPES, recipeReason, STATION_NAME, type Recipe } from '../../src/game/recipes';
import { FORAGE_TABLE, BOTANIZE_TABLE, BOTANIZE_WATER_TABLE } from '../../src/game/forage';
import { PAN_ORES } from '../../src/game/actions';
import { BUSH_DEFS, ROCK_VARIANTS } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

void ACTIONS.length;

const recipe = (id: string): Recipe => {
  const r = RECIPE_BY_ID.get(id);
  if (!r) throw new Error(`there is no recipe ${id}`);
  return r;
};
const sql1 = (q: string): string => psql(q).split('\n')[0]?.trim() ?? '';

/* ---- obsidian, and where it comes from ------------------------------------------------------------- */
const O = ITEM_DEFS.obsidian;
check('obsidian is the same raw material on both sides',
  !!O && O.name === 'Obsidian' && O.category === 'material' && !!O.raw && !!O.stackable && O.decay === 0
    && sql1(`select name || '|' || category || '|' || weight from item_def where id = 'obsidian';`) === `${O.name}|${O.category}|${O.weight}`,
  sql1(`select name || '|' || category || '|' || weight from item_def where id = 'obsidian';`));
const madeHere = RECIPES.filter((r) => r.result === 'obsidian' || (r.returns ?? []).some(([id]) => id === 'obsidian')).map((r) => r.id);
const madeThere = psql(`select string_agg(id, ',') from recipe where result = 'obsidian';`)
  + psql(`select string_agg(recipe, ',') from recipe_gives where item = 'obsidian';`);
check('no recipe makes obsidian or hands it back, on either side', madeHere.length === 0 && madeThere === '', `${madeHere.join(',')} ${madeThere}`);
const foundHere = [
  ...[FORAGE_TABLE, BOTANIZE_TABLE, BOTANIZE_WATER_TABLE].flatMap((t) => t.filter(([id]) => id === 'obsidian').map(() => 'loot')),
  ...ROCK_VARIANTS.filter((r) => (r as { yields?: string }).yields === 'obsidian').map(() => 'rock'),
  ...BUSH_DEFS.filter((b) => b.yields === 'obsidian').map(() => 'bush'),
  ...PAN_ORES.filter((id) => id === 'obsidian').map(() => 'pan'),
];
const foundThere = psql(`select concat_ws(',',
  (select string_agg(id, ',') from loot_table where item = 'obsidian'),
  (select string_agg(name, ',') from rock_def where yields = 'obsidian'),
  (select string_agg(name, ',') from bush_def where yields = 'obsidian'),
  (select string_agg(item, ',') from pan_ore where item = 'obsidian'),
  (select string_agg(item, ',') from hoard_metal where item = 'obsidian'));`);
check('and nothing gathered finds it: no forage, botanizing, rock, bush, pan or hoard, on either side',
  foundHere.length === 0 && foundThere === '', `${foundHere.join(',')} ${foundThere}`);

/* ---- the set ---------------------------------------------------------------------------------------- */
const C = ARMOUR_CLASSES.obsidian;
check('one obsidian piece to each place armour is worn',
  OBSIDIAN_PIECES.length === ARMOUR_SLOTS.length && ARMOUR_SLOTS.every((s) => ARMOUR.some((a) => a.cls === 'obsidian' && a.slot === s)),
  OBSIDIAN_PIECES.join(', '));
check('its soak between plate and scale, lighter than plate',
  C.soak > ARMOUR_CLASSES.plate.soak && C.soak < ARMOUR_CLASSES.scale.soak && C.burden < ARMOUR_CLASSES.plate.burden,
  `soak ${C.soak}, burden ${C.burden}`);
const V = ARMOUR_VS.obsidian;
check('the best of any class against cuts and burns, the worst against crushing',
  Object.entries(ARMOUR_VS).every(([cls, t]) => cls === 'obsidian' || (V.cut > t.cut && V.burn > t.burn && V.crush < t.crush)),
  JSON.stringify(V));
const plateWeight = ARMOUR.filter((a) => a.cls === 'plate' && a.id !== 'ancient_helm').reduce((n, a) => n + ITEM_DEFS[a.id].weight, 0);
const obsidianWeight = OBSIDIAN_PIECES.reduce((n, id) => n + ITEM_DEFS[id].weight, 0);
check('a whole set weighs less than plate', obsidianWeight < plateWeight, `${obsidianWeight} kg against ${plateWeight} kg`);
check('the class the same on both sides',
  sql1(`select soak || '|' || burden || '|' || skill from armour_class_def where id = 'obsidian';`) === `${C.soak}|${C.burden}|${C.skill}`,
  sql1(`select soak || '|' || burden || '|' || skill from armour_class_def where id = 'obsidian';`));
const vsThere = psql(`select string_agg(k || '=' || armour_vs('obsidian', k), ',' order by k) from unnest(array['bite', 'burn', 'crush', 'cut', 'pierce']) k;`);
const vsHere = ['bite', 'burn', 'crush', 'cut', 'pierce'].map((k) => `${k}=${V[k as keyof typeof V]}`).join(',');
check('and what each blow does to it', vsThere === vsHere, `browser ${vsHere}, island ${vsThere}`);
for (const id of OBSIDIAN_PIECES) {
  const a = ARMOUR.find((x) => x.id === id)!;
  const r = recipe(`make_${id}`), want = OBSIDIAN_ARMOUR[id];
  const said = [r.result, r.skill, r.tool, r.station, r.difficulty, r.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join(',')].join('|');
  const theirs = sql1(`select r.result || '|' || r.skill || '|' || r.tool || '|' || r.station || '|' || r.difficulty || '|'
      || (select string_agg(i.item || 'x' || i.count, ',' order by i.ord) from recipe_input i where i.recipe = r.id) from recipe r where r.id = 'make_${id}';`);
  check(`${ITEM_DEFS[id].name}: ${a.slot}; ${said} on both sides`,
    theirs === said && r.station === 'anvil' && r.skill === 'platesmithing' && r.tool === 'hammer'
      && said.endsWith(`obsidianx${want.obsidian},leatherx${want.leather}`)
      && sql1(`select slot || '|' || cls || '|' || (select weight from item_def where id = '${id}') from armour_def where id = '${id}';`) === `${a.slot}|obsidian|${ITEM_DEFS[id].weight}`,
    `island ${theirs}`);
  const desc = ITEM_DEFS[id].description ?? '';
  check(`${ITEM_DEFS[id].name}: its line says its numbers, derived`, desc.includes(armourSays('obsidian')) && desc.includes(`${Math.round(C.soak * 100)}%`) && !desc.includes('{'), desc);
  check(`${ITEM_DEFS[id].name}: improved with obsidian at platesmithing on both sides`,
    improvable(id)?.material.id === 'obsidian' && improvable(id)?.skill === 'platesmithing'
      && sql1(`select material || '|' || skill from improvable_of('${id}', null);`) === 'obsidian|platesmithing');
}

/* ---- the knapped tools and weapons ------------------------------------------------------------------ */
const M = OBSIDIAN_MATERIAL;
const metals = MATERIALS.filter((m) => m.kind === 'metal');
check('Obsidian: the keenest edge and the truest bite of anything, by OBSIDIAN_KEEN, and the fastest wear, by OBSIDIAN_WEAR',
  metals.every((m) => m.edge < M.edge && m.bite < M.bite && m.wear < M.wear)
    && Math.abs(M.edge - Math.max(...metals.map((m) => m.edge)) - OBSIDIAN_KEEN) < 1e-9
    && Math.abs(M.bite - Math.max(...metals.map((m) => m.bite)) - OBSIDIAN_KEEN) < 1e-9
    && Math.abs(M.wear - Math.max(...metals.map((m) => m.wear)) * OBSIDIAN_WEAR) < 1e-9,
  `edge ${M.edge}, bite ${M.bite}, wear ${M.wear}`);
check('and the same numbers on both sides',
  sql1(`select name || '|' || edge || '|' || bite || '|' || wear || '|' || difficulty from material_def where id = 'obsidian';`) === `${M.name}|${M.edge}|${M.bite}|${M.wear}|${M.difficulty}`,
  sql1(`select name || '|' || edge || '|' || bite || '|' || wear || '|' || difficulty from material_def where id = 'obsidian';`));
// (the island keeps a material's numbers as `real`: the same to six figures)
const [edgeThere, qlThere] = sql1(`select mat_edge('${OBSIDIAN}') || '|' || working_ql(50, '${OBSIDIAN}');`).split('|').map(Number);
check('a knapped edge works out on the island as in the browser: damage and tool QL',
  Math.abs(edgeThere - M.edge) < 1e-6 && Math.abs(qlThere - workingQl(50, OBSIDIAN)) < 1e-4, `island ${edgeThere} and ${qlThere}`);
const MAIN_TOOLS = ['hatchet', 'pickaxe', 'shovel', 'saw', 'carving_knife', 'butchering_knife', 'sickle', 'hammer', 'chisel'];
const kinds = new Set(Object.keys(KNAPPED).filter(isWeapon).map((id) => WEAPON_BY_ID.get(id)!.kind));
check('every main tool, and every weapon kind with a head or a blade, knapped',
  MAIN_TOOLS.every((id) => id in KNAPPED) && ['knives', 'swords', 'axes', 'mauls', 'polearms', 'throwing'].every((k) => kinds.has(k as never)),
  [...kinds].join(', '));
for (const [id, k] of Object.entries(KNAPPED)) {
  const r = recipe(knapRecipeId(id));
  const said = [r.result, r.skill, r.tool, r.extra, r.difficulty, r.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join(',')].join('|');
  const theirs = sql1(`select r.result || '|' || r.skill || '|' || r.tool || '|' || r.extra || '|' || r.difficulty || '|'
      || (select string_agg(i.item || 'x' || i.count, ',' order by i.ord) from recipe_input i where i.recipe = r.id) from recipe r where r.id = '${r.id}';`);
  check(`${r.label}: ${said} on both sides`,
    theirs === said && r.skill === 'stonecutting' && r.tool === 'chisel' && r.extra === OBSIDIAN && r.difficulty === KNAP_DIFFICULTY + KNAP_PER * k.obsidian,
    `island ${theirs}`);
  const how = improvable(id, OBSIDIAN);
  check(`${r.label}: improved with obsidian at stonecutting, on both sides`,
    how?.material.id === 'obsidian' && how.skill === 'stonecutting'
      && sql1(`select material || '|' || skill from improvable_of('${id}', '${OBSIDIAN}');`) === 'obsidian|stonecutting'
      && sql1(`select material from improvable_of('${id}', 'Iron');`) === (improvable(id, 'Iron')?.material.id ?? ''));
}

/* ---- made on the island ------------------------------------------------------------------------------- */
const count = (def: string): string =>
  `(select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${def}')`;
const newest = (def: string): string =>
  `(select i.id from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${def}' order by i.id desc limit 1)`;
const HELM = recipe('make_obsidian_helm'), HATCHET = recipe(knapRecipeId('hatchet'));
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; v_h bigint;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from placed where world_id = w and x between 6 and 15 and y between 6 and 13;
  update player set body_at = now(), x = 9.5, y = 9.5, act = null, act_target = null, act_queue = '[]', craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into skill (world_id, uid, id, value) values (w, u, 'platesmithing', 90), (w, u, 'stonecutting', 90)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
     p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';

  perform give(w, u, 'hammer', 1, 40, 'Iron', null, null, null, null);
  perform give(w, u, 'chisel', 1, 40, 'Iron', null, null, null, null);
  perform give(w, u, 'obsidian', ${HELM.inputs[0].count}, 50, null, null, null, null, null);
  perform give(w, u, 'leather', ${HELM.inputs[1].count}, 50, null, null, null, null, null);
  insert into said values ('NOANVIL', coalesce(craft_refusal(w, u, '${HELM.id}', null), 'ALLOWED'));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'anvil', 'iron', 10, 9, 0, 0, 10.25, 9.25, 50, u);
  insert into said values ('ANVIL', coalesce(craft_refusal(w, u, '${HELM.id}', null), 'ALLOWED'));
  perform perform_craft(w, u, '${HELM.id}', jsonb_build_object('kind', 'item', 'uid', ${newest('obsidian')}));
  insert into said values ('HELM', ${count('obsidian_helm')}::text || '|' || ${count('obsidian')} || '|' || ${count('leather')});

  perform give(w, u, 'obsidian', ${HATCHET.inputs[0].count}, 50, null, null, null, null, null);
  perform give(w, u, 'shaft', 1, 50, 'Oak', null, null, null, null);
  perform perform_craft(w, u, '${HATCHET.id}', jsonb_build_object('kind', 'item', 'uid', ${newest('obsidian')}));
  select i.id into v_h from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'hatchet' order by i.id desc limit 1;
  insert into said values ('HATCHET', coalesce((select extra from item where id = v_h), 'none') || '|' || ${count('obsidian')});
  perform damage_item(v_h, 1);
  insert into said values ('WEAR', (select dmg from item where id = v_h)::text);
  update item set dmg = 0 where id = v_h;
  insert into said values ('IMPROVE', coalesce(item_refusal(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_h)), 'ALLOWED'));
  perform give(w, u, 'obsidian', 1, 50, null, null, null, null, null);
  insert into said values ('IMPROVE2', coalesce(item_refusal(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_h)), 'ALLOWED'));
end $$;
select k || '=' || v from said order by k;
rollback;`);
const got = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'MISSING';

const game = Game.create(4242);
// The island's player's (above): obsidian armour and knapping are gated by their difficulty (`craftgates.ts`).
game.skills.values.set('platesmithing', 90);
game.skills.values.set('stonecutting', 90);
game.player.x = 9.5;
game.player.y = 9.5;
game.inventory.add('hammer', { ql: 40, extra: 'Iron' });
game.inventory.add('obsidian', { ql: 50, count: HELM.inputs[0].count });
game.inventory.add('leather', { ql: 50, count: HELM.inputs[1].count });
const noAnvil = recipeReason(HELM, game) ?? 'ALLOWED';
game.addAnvil(10, 9, 0, 0, 'iron', 50);
const atAnvil = recipeReason(HELM, game) ?? 'ALLOWED';
check(`no anvil, no obsidian armour: "${noAnvil}" on both sides`, noAnvil === `Need: ${STATION_NAME.anvil}.` && got('NOANVIL') === noAnvil, `island ${got('NOANVIL')}`);
check('beside one, allowed on both sides', atAnvil === 'ALLOWED' && got('ANVIL') === 'ALLOWED', `browser ${atAnvil}, island ${got('ANVIL')}`);
check(`${HELM.label} on the island: the helm made, the obsidian and the leather spent`, got('HELM') === '1|0|0', got('HELM'));
check(`${HATCHET.label} on the island: a hatchet of ${OBSIDIAN}, the obsidian spent`, got('HATCHET') === `${OBSIDIAN}|0`, got('HATCHET'));
check(`and a use wears it ${M.wear} where copper wears 1`, Math.abs(Number(got('WEAR')) - M.wear) < 1e-6, got('WEAR'));
check('improving it wants obsidian, and goes with it, on the island',
  got('IMPROVE') === 'Need obsidian to work into it.' && got('IMPROVE2') === 'ALLOWED', `${got('IMPROVE')} / ${got('IMPROVE2')}`);

/* ---- obsidian glass ------------------------------------------------------------------------------------- */
const G = BUILD_MATERIAL_BY_ID.get(OBSIDIAN_GLASS)!;
const billSaid = (b: Record<string, number>): string => JSON.stringify(Object.entries(b).sort());
const wallMine = billSaid(wallBill(OBSIDIAN_GLASS, 'solid').total);
const wallTheirs = billSaid(JSON.parse(sql1(`select wall_bill('${OBSIDIAN_GLASS}', 'solid')::text;`) || '{}'));
const floorMine = billSaid(floorBill(OBSIDIAN_GLASS, 'floor').total);
const floorTheirs = billSaid(JSON.parse(sql1(`select floor_bill('${OBSIDIAN_GLASS}', 'floor')::text;`) || '{}'));
check('a solid obsidian glass wall takes obsidian and mortar, the same bill on both sides', wallMine === wallTheirs && wallMine.includes('obsidian') && wallMine.includes('mortar'),
  `browser ${wallMine}, island ${wallTheirs}`);
check('and a floor of it its share, the same on both sides', floorMine === floorTheirs && floorMine.includes('obsidian'), `browser ${floorMine}, island ${floorTheirs}`);
check('laid with a trowel, in masonry, as tall and as heavy, on both sides',
  sql1(`select kind || '|' || tool || '|' || skill || '|' || storeys || '|' || heft from build_material_def where id = '${OBSIDIAN_GLASS}';`)
    === `${G.kind}|${G.tool}|${G.skill}|${G.storeys}|${G.heft}` && G.tool === 'trowel' && G.skill === 'masonry' && G.storeys === 10,
  sql1(`select kind || '|' || tool || '|' || skill || '|' || storeys || '|' || heft from build_material_def where id = '${OBSIDIAN_GLASS}';`));
check(`drawn ${Math.round(OBSIDIAN_GLASS_OPACITY * 100)}% opaque, and seen through`, OBSIDIAN_GLASS_OPACITY === 0.8 && !!G.seeThrough);
const asked = [
  ...WALL_TYPES.map((wt) => ({ what: `a ${wt.name.toLowerCase()}`, mine: onlyRefusal(OBSIDIAN_GLASS, { wall: wt.id }), sql: `'${wt.id}', null` })),
  ...(['floor', 'stairs', 'ladder', 'roof'] as const).map((k) => ({ what: `a ${k}`, mine: onlyRefusal(OBSIDIAN_GLASS, { floor: k }), sql: `null, '${k}'` })),
  { what: 'a column', mine: onlyRefusal(OBSIDIAN_GLASS, { column: true }), sql: `'column', null` },
];
const theirsOnly = psql(asked.map((a) => `select coalesce(material_only_refusal('${OBSIDIAN_GLASS}', ${a.sql}), 'ALLOWED');`).join('\n')).split('\n');
const allowed = asked.filter((a) => a.mine === null).map((a) => a.what);
check('obsidian glass is a solid wall or a floor and nothing else, in the same words on both sides',
  asked.every((a, i) => (a.mine ?? 'ALLOWED') === theirsOnly[i]) && allowed.join() === 'a solid,a floor'
    && theirsOnly.filter((s) => s !== 'ALLOWED').every((s) => s === onlySaid(G)),
  `allowed: ${allowed.join(', ')}; differ: ${asked.filter((a, i) => (a.mine ?? 'ALLOWED') !== theirsOnly[i]).map((a) => a.what).join(', ') || 'none'}`);

/* ---- and built on the island: a wall, a floor, and a storey over them, as the browser builds them -------- */
const SIDES = ['n', 'e', 's', 'w'] as const;
const border = (side: string): string => {
  const bx = side === 'e' ? 6 : 5, by = side === 's' ? 6 : 5, dir = side === 'n' || side === 's' ? 'h' : 'v';
  return `'${dir}', ${bx}, ${by}`;
};
const built = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from wall where world_id = w; delete from floor_tile where world_id = w;
  delete from building_tile where world_id = w; delete from building where world_id = w;
  -- (plain ground under it, not the field the suite leaves there)
  perform land_set_tile(w, 5, 5, tile_id('Dirt')); perform land_set_data(w, 5, 5, 0);
  delete from placed where world_id = w and x between 3 and 7 and y between 3 and 7;
  update player set body_at = now(), x = 5.5, y = 5.5, act = null, act_target = null, act_queue = '[]', craft_from_stores = false
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into skill (world_id, uid, id, value) values (w, u, 'masonry', 90) on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 77, 'Glasshouse', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, 77, 5, 5);
  perform give(w, u, 'trowel', 1, 40, 'Iron', null, null, null, null);
  perform give(w, u, 'mallet', 1, 40, 'Oak', null, null, null, null);
  insert into said values ('PLANWALL', coalesce(build_refusal(w, u, 'plan_wall', jsonb_build_object('x', 5, 'y', 5,
    'side', 'n', 'wallType', 'solid', 'material', '${OBSIDIAN_GLASS}')), 'ALLOWED'));
  insert into said values ('PLANFLOOR', coalesce(build_refusal(w, u, 'plan_floor', jsonb_build_object('x', 5, 'y', 5,
    'floorKind', 'floor', 'material', '${OBSIDIAN_GLASS}')), 'ALLOWED'));
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, 0, ${border('n')}, 77, 'solid', '${OBSIDIAN_GLASS}', wall_bill('${OBSIDIAN_GLASS}', 'solid'), wall_bill('${OBSIDIAN_GLASS}', 'solid'));
  insert into floor_tile (world_id, level, x, y, building, kind, material, needed, total)
    values (w, 0, 5, 5, 77, 'floor', '${OBSIDIAN_GLASS}', floor_bill('${OBSIDIAN_GLASS}', 'floor'), floor_bill('${OBSIDIAN_GLASS}', 'floor'));
  insert into said values ('NOSTOCK', coalesce(build_refusal(w, u, 'build_wall', jsonb_build_object('x', 5, 'y', 5, 'side', 'n')), 'ALLOWED'));
  perform give(w, u, 'obsidian', 100, 50, null, null, null, null, null);
  perform give(w, u, 'mortar', 100, 50, null, null, null, null, null);
  insert into said values ('BUILDWALL', coalesce(build_refusal(w, u, 'build_wall', jsonb_build_object('x', 5, 'y', 5, 'side', 'n')), 'ALLOWED'));
  insert into said values ('BUILDFLOOR', coalesce(build_refusal(w, u, 'build_floor', jsonb_build_object('x', 5, 'y', 5, 'floorKind', 'floor')), 'ALLOWED'));
  -- The four walls finished, and a second storey asked for over them, at masonry 5 and at 90.
  delete from wall where world_id = w;
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
    ${SIDES.map((sd) => `(w, 0, ${border(sd)}, 77, 'solid', '${OBSIDIAN_GLASS}', '{"obsidian": 0}', wall_bill('${OBSIDIAN_GLASS}', 'solid'))`).join(',\n    ')};
  update floor_tile set needed = '{"obsidian": 0}' where world_id = w and building = 77;
  insert into said values ('STOREYS', storey_cap(w, 77)::text);
  update skill set value = 5 where world_id = w and uid = u and id = 'masonry';
  insert into said values ('LOWSKILL', coalesce(build_refusal(w, u, 'add_floor', '{"x": 5, "y": 5}'::jsonb), 'ALLOWED'));
  update skill set value = 90 where world_id = w and uid = u and id = 'masonry';
  insert into said values ('STOREY2', coalesce(build_refusal(w, u, 'add_floor', '{"x": 5, "y": 5}'::jsonb), 'ALLOWED'));
end $$;
select k || '=' || v from said order by k;
rollback;`);
const b = (k: string): string => built.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'MISSING';

const home = Game.create(4343);
const bld = home.buildings;
const tower = bld.create('Glasshouse', 5, 5);
home.player.x = 5.5;
home.player.y = 5.5;
home.inventory.add('mallet', { ql: 40 });
home.inventory.add('trowel', { ql: 40 });
for (const side of SIDES) {
  const w = bld.setWall(tower, 0, 5, 5, side, 'solid', OBSIDIAN_GLASS);
  for (const k of Object.keys(w.needed)) w.needed[k] = 0;
}
const addFloor = ACTIONS.find((a) => a.id === 'add_floor')!;
const ask = (): string => addFloor.check?.({ kind: 'tile', x: 5, y: 5, cx: 5, cy: 5 } as never, home) ?? 'ALLOWED';
home.skills.values.set('masonry', 5);
const lowMine = ask();
home.skills.values.set('masonry', 90);
const highMine = ask();
check('the island plans a solid wall and a floor of obsidian glass', b('PLANWALL') === 'ALLOWED' && b('PLANFLOOR') === 'ALLOWED', `${b('PLANWALL')} / ${b('PLANFLOOR')}`);
check('and asks for obsidian and mortar to build the wall', /obsidian/i.test(b('NOSTOCK')) && /mortar/i.test(b('NOSTOCK')), b('NOSTOCK'));
check('and builds the wall and the floor with them in the pack', b('BUILDWALL') === 'ALLOWED' && b('BUILDFLOOR') === 'ALLOWED', `${b('BUILDWALL')} / ${b('BUILDFLOOR')}`);
check(`a building of it stands ${G.storeys} storeys on the island`, b('STOREYS') === String(G.storeys), b('STOREYS'));
check(`a storey over it takes masonry ${storeySkill(1)}, in the same words on both sides`,
  lowMine === `Storey 2 over obsidian glass needs masonry ${storeySkill(1)}; have 5.0.` && b('LOWSKILL') === lowMine,
  `browser "${lowMine}", island "${b('LOWSKILL')}"`);
check('and with it, allowed on both sides', highMine === 'ALLOWED' && b('STOREY2') === 'ALLOWED', `browser "${highMine}", island "${b('STOREY2')}"`);

void MATERIAL_BY_ID;
for (const l of [...ok, ...bad]) console.log(l);
console.log(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
if (bad.length) process.exit(1);
