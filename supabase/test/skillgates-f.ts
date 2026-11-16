/**
 * Skill gates, the sixth set (batch F): the sweep's recommended gates, and a trade's first steps brought down.
 *
 * Asked for: "Add those recommended gates. … Bring the awl and leather down. Same with papyrus milling and ropemaking
 * first steps. For smithing, working a casting should have requirements equal to the smelting gate parallels."
 * Asked of the island and the browser:
 *
 *   * the island's skill_gate and skill_gate_item are the browser's for every new kind, row for row: graft, water
 *     plants, treasure maps, bridges, smelting, castings, stones in a circlet, a listed cross, spells;
 *   * smelting an ore, pouring it and working a casting of it read the one table (`METAL_GATE`): every mined metal's
 *     smelting gate is its pouring gate, and its casting gate in each trade is the same number;
 *   * each refused in the one rule's words on both sides under its level, and past the gate at it: Graft at forestry
 *     49, tin smelting at 2.3, a tin sword blade casting at weaponsmithing 2.3, a drawbridge and a stone brick bridge,
 *     an aqueduct, a diamond in a circlet, a sound map dug up (and read under it: decided, batch G); a cross and Pyre in the same words;
 *   * a lily root and a treasure map unidentified under their gate, with what identifies them; lotus seeds never;
 *   * the bowstring, the short bow, the awl, leather, papyrus, the paper press and rope open at 1;
 *   * workers at their own level in the gate's skill: a smelter worker's ore, a water planter's roots; idle `gate` in
 *     the stores' words; a hod carrier's spans at its level (masonry for a Brickling), whatever the gate's skill;
 *   * the Unlocks lists: digging's maps, smelting's metals, jewellery's settings, botanizing's plants, forestry's Graft,
 *     each casting trade's metals.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import {
  bridgeGateRefusal, CASTING_SKILLS, castingGate, castingGateId, gemLevel, hodMay, MAP_GATE_PER_TIER,
  METAL_GATE, recipeLevel, SMELT_SKILL, waterPlantGateRefusal, workerSmeltOpen, workerWaterPlantOpen,
} from '../../src/game/craftgates';
import { METALS, MOULD_SKILL } from '../../src/game/metal';
import { idleSays } from '../../src/game/workerlog';
import { spellDef, spellRefusal } from '../../src/game/arcane';
import { GEMS } from '../../src/game/gems';
import { TREASURE_TIERS } from '../../src/game/treasure';
import { BRIDGES } from '../../src/game/bridges';
import { WATER_PLANT_BY_ID } from '../../src/world/waterplants';
import {
  GATED_ITEMS, gateOf, identifySaid, itemGateRefusal, kindGateRefusal as kindRefusal, seenName, SKILL_GATES, unlockRows, unlocksOf, UNLOCKS_GROUPED_OVER,
} from '../../src/game/skillgates';
import { packTreeData, TileType, TREE_DEFS } from '../../src/world/tiles';
import type { Bridge, BridgeSpan } from '../../src/game/bridges';
import { creatureLevel } from '../../src/game/creatures';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000f7e01';
const T = 40;
const SEED = 313;
const KINDS = ['graft', 'water_plant', 'hoard', 'bridge', 'smelt', 'casting', 'gem', 'cross', 'spell'];
/** The trade's first steps brought down to 1 (decided, batch F). */
const LOWERED = ['make_bow_string', 'make_short_bow', 'make_awl', 'tan_hide', 'make_papyrus', 'make_paper_press', 'make_rope'];
/** The smelter's tile and the anvil's, beside where you stand (`T` + 3.5, `T` + 1.5). */
const SX = T + 4;
const SY = T + 1;
const AX = T + 3;
const AY = T + 2;
/** The tree grafted, beside you. */
const GX = T + 2;
const GY = T + 1;
const OAK = TREE_DEFS.findIndex((d) => d.name === 'Oak');
const MATURE = 1;
/** A drawbridge's span, for a hod carrier. */
const BX = T + 10;
const BY = T + 6;
const target = (o: Record<string, unknown>): string => `'${JSON.stringify(o)}'::jsonb`;
const refused = (call: string): string => `coalesce(${call}, 'ALLOWED')`;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.skill(w uuid, u uuid, id text, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, id, v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
create function pg_temp.worker(w uuid, u uuid, p_skills jsonb) returns creature language plpgsql as $m$
declare v int; c creature;
begin
  v := creature_spawn(w, 'magga', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set skills = p_skills where world_id = w and id = v returning * into c;
  return c;
end $m$;
create function pg_temp.hod(w uuid, u uuid, p_skills jsonb) returns creature language plpgsql as $m$
declare v int; c creature;
begin
  v := creature_spawn(w, 'cobbe', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set skills = p_skills where world_id = w and id = v returning * into c;
  return c;
end $m$;
do $t$
declare w uuid; u uuid := '${U}'; v_it item; v_id bigint; c creature; v_smelter bigint; v_anvil bigint; v_tin bigint; v_copper bigint;
        v_blade bigint; v_head bigint; v_gem bigint; v_topaz bigint; v_map bigint; v_b bigint; r text;
begin
  insert into said select 'GATES', string_agg(kind || ':' || id || ':' || name || ':' || skill || ':' || level, ',' order by kind collate "C", id collate "C")
    from skill_gate where kind in (${KINDS.map((k) => `'${k}'`).join(', ')});
  insert into said select 'ITEMS', string_agg(item || ':' || extra || ':' || kind || ':' || id || ':' || noun, ',' order by item collate "C", extra collate "C")
    from skill_gate_item where kind in (${KINDS.map((k) => `'${k}'`).join(', ')});
  insert into said select 'LOWERED', string_agg(id || ':' || level, ',' order by id collate "C")
    from skill_gate where kind = 'recipe' and id in (${LOWERED.map((k) => `'${k}'`).join(', ')});
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates F', ${SEED}, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T + 3}.5, y = ${T + 1}.5, body_at = now(), seen_at = now(),
         stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;

  /* ---- the first steps, open at 1 ---- */
${['bowyery', 'leatherworking', 'papyrusmaking', 'carpentry', 'ropemaking'].map((s) => `  perform pg_temp.skill(w, u, '${s}', 1);`).join('\n')}
${LOWERED.map((id) => `  insert into said values ('LOW_${id}', ${refused(`craft_refusal(w, u, '${id}', null)`)});`).join('\n')}

  /* ---- Graft ---- */
  perform land_set_tile(w, ${GX}, ${GY}, tile_id('Tree'));
  perform land_set_data(w, ${GX}, ${GY}, tree_pack(${OAK}, ${MATURE}));
  perform give(w, u, 'sprout', 1, 50, 'Apple');
  perform give(w, u, 'carving_knife', 1, 40, null);
  perform pg_temp.skill(w, u, 'forestry', 49);
  insert into said values ('GRAFT49', ${refused(`ground_refusal(w, u, 'graft', ${target({ kind: 'tile', x: GX, y: GY })})`)});
  perform pg_temp.skill(w, u, 'forestry', 50);
  insert into said values ('GRAFT50', ${refused(`ground_refusal(w, u, 'graft', ${target({ kind: 'tile', x: GX, y: GY })})`)});

  /* ---- a cross, a spell ---- */
  perform pg_temp.skill(w, u, 'animal_husbandry', 49);
  insert into said values ('CROSS49', ${refused(`kind_gate_refusal(w, u, 'cross', 'cross')`)});
  perform pg_temp.skill(w, u, 'kindling', 12);
  insert into said values ('PYRE12', ${refused(`kind_gate_refusal(w, u, 'spell', 'pyre')`)});
  insert into said values ('EMBER12', ${refused(`kind_gate_refusal(w, u, 'spell', 'ember')`)});

  /* ---- water plants ---- */
  v_id := give(w, u, 'lily_root', 1, 30, null);
  select * into v_it from item where id = v_id;
  perform pg_temp.skill(w, u, 'botanizing', 5);
  insert into said values ('LILY5', ${refused(`water_plant_gate_refusal(w, u, 'lily')`)});
  insert into said values ('LILY5_NAME', seen_name(w, u, v_it));
  insert into said values ('LILY5_TIP', coalesce(identify_said(w, u, v_it.def, v_it.extra), 'none'));
  perform pg_temp.skill(w, u, 'botanizing', 15);
  insert into said values ('LILY15', ${refused(`water_plant_gate_refusal(w, u, 'lily')`)});
  insert into said values ('LILY15_NAME', seen_name(w, u, v_it));
  insert into said values ('LOTUS15', ${refused(`water_plant_gate_refusal(w, u, 'lotus')`)});
  v_id := give(w, u, 'lotus_seed', 1, 30, null);
  select * into v_it from item where id = v_id;
  insert into said values ('LOTUS15_NAME', seen_name(w, u, v_it));
  perform pg_temp.skill(w, u, 'botanizing', 20);
  insert into said values ('LOTUS20', ${refused(`water_plant_gate_refusal(w, u, 'lotus')`)});

  /* ---- a treasure map ---- */
  v_map := give(w, u, 'treasure_map', 1, 30, 'sound');
  select * into v_it from item where id = v_map;
  perform pg_temp.skill(w, u, 'digging', 4);
  insert into said values ('MAP4_NAME', seen_name(w, u, v_it));
  insert into said values ('MAP4_TIP', coalesce(identify_said(w, u, v_it.def, v_it.extra), 'none'));
  insert into said values ('MAP4_DIG', ${refused(`treasure_refusal(w, u, 'unearth', jsonb_build_object('uid', v_map))`)});
  insert into said values ('MAP4_READ', coalesce(rpc_treasure_map(w, v_map)->>'why', 'READ'));
  perform pg_temp.skill(w, u, 'digging', 20);
  insert into said values ('MAP20_NAME', seen_name(w, u, v_it));
  insert into said values ('MAP20_DIG', ${refused(`treasure_refusal(w, u, 'unearth', jsonb_build_object('uid', v_map))`)});

  /* ---- bridges and an aqueduct ---- */
  perform give(w, u, 'mallet', 1, 40, null);
  perform give(w, u, 'trowel', 1, 40, null);
  perform pg_temp.skill(w, u, 'carpentry', 49);
  insert into said values ('DRAW49', ${refused(`last_refusal(w, u, 'plan_bridge', ${target({ kind: 'tile', x: T + 8, y: T + 1, material: 'draw' })})`)});
  perform pg_temp.skill(w, u, 'carpentry', 50);
  insert into said values ('DRAW50', ${refused(`last_refusal(w, u, 'plan_bridge', ${target({ kind: 'tile', x: T + 8, y: T + 1, material: 'draw' })})`)});
  perform pg_temp.skill(w, u, 'masonry', 9);
  insert into said values ('BRICK9', ${refused(`last_refusal(w, u, 'plan_bridge', ${target({ kind: 'tile', x: T + 8, y: T + 1, material: 'stone_brick' })})`)});
  perform pg_temp.skill(w, u, 'masonry', 69);
  insert into said values ('AQ69', ${refused(`aqueduct_refusal(w, u, 'plan_aqueduct', ${target({ kind: 'tile', x: T + 5, y: T + 1, head: [T + 6, T + 1] })})`)});
  perform pg_temp.skill(w, u, 'masonry', 70);
  insert into said values ('AQ70', ${refused(`aqueduct_refusal(w, u, 'plan_aqueduct', ${target({ kind: 'tile', x: T + 5, y: T + 1, head: [T + 6, T + 1] })})`)});
  -- A drawbridge's plan, half laid: adding to it at carpentry 49, and a hod carrier at its level.
  insert into bridge (world_id, kind, ax, ay, bx, by, height) values (w, 'draw', ${BX}, ${BY}, ${BX + 1}, ${BY}, 52) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_b, 0, ${BX}, ${BY}, '{"plank": 10}', '{"plank": 10}');
  update player set x = ${BX}.5, y = ${BY + 1}.5 where world_id = w and uid = u;
  perform pg_temp.skill(w, u, 'carpentry', 49);
  insert into said values ('BUILD49', ${refused(`last_refusal(w, u, 'build_bridge', jsonb_build_object('kind', 'bridge', 'id', v_b))`)});
  update player set x = ${T + 3}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  c := pg_temp.hod(w, u, '{"masonry": 30, "carpentry": 1}');
  insert into said values ('HOD_SPAN30', hod_may(w, c, 'span', 0, '', ${BX}, ${BY}) || '');
  c := pg_temp.hod(w, u, '{"masonry": 1, "carpentry": 50}');
  insert into said values ('HOD_SPAN_C50', hod_may(w, c, 'span', 0, '', ${BX}, ${BY}) || '');
  c := pg_temp.hod(w, u, '{"masonry": 50, "carpentry": 1}');
  insert into said values ('HOD_SPAN50', hod_may(w, c, 'span', 0, '', ${BX}, ${BY}) || '');

  /* ---- smelting, by the metal ---- */
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', ${SX}, ${SY}, 0, 0, ${SX}.375, ${SY}.25, 50, 600, true, '{"jobs": [], "output": []}'::jsonb, u)
    returning id into v_smelter;
  v_tin := give(w, u, 'tin_ore', 5, 40, null);
  v_copper := give(w, u, 'copper_ore', 5, 40, null);
  perform pg_temp.skill(w, u, 'smelting', 2.3);
  insert into said values ('SMELT_TIN2', ${refused(`firing_refusal(w, u, 'smelt_ore', jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'itemUid', v_tin))`)});
  insert into said values ('SMELT_COPPER2', ${refused(`firing_refusal(w, u, 'smelt_ore', jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'itemUid', v_copper))`)});
  perform pg_temp.skill(w, u, 'smelting', 10);
  insert into said values ('SMELT_TIN10', ${refused(`firing_refusal(w, u, 'smelt_ore', jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'itemUid', v_tin))`)});
  c := pg_temp.worker(w, u, '{"smelting": 1}');
  insert into said values ('SMELTER1', array_to_string(worker_furnace_fits(c, 'smelt'), ','));
  c := pg_temp.worker(w, u, '{"smelting": 10}');
  insert into said values ('SMELTER10', array_to_string(worker_furnace_fits(c, 'smelt'), ','));
  c := pg_temp.worker(w, u, '{"pottery": 1}');
  insert into said values ('KILN1', (worker_furnace_fits(c, 'kiln') = furnace_fits('kiln'))::text);
  c := pg_temp.worker(w, u, '{"botanizing": 1}');
  insert into said values ('ROOTS1', array_to_string(worker_roots(c), ','));
  c := pg_temp.worker(w, u, '{"botanizing": 10}');
  insert into said values ('ROOTS10', array_to_string(worker_roots(c), ','));
  c := pg_temp.worker(w, u, '{"botanizing": 20}');
  insert into said values ('ROOTS20', array_to_string(worker_roots(c), ','));

  /* ---- working a casting, by the metal ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'anvil', 'iron', ${AX}, ${AY}, 0, 0, ${AX}.25, ${AY}.25, 50, u) returning id into v_anvil;
  perform give(w, u, 'hammer', 1, 40, null);
  v_blade := give(w, u, 'casting', 1, 40, 'Tin');
  update item set piece = 'sword_blade' where id = v_blade;
  v_head := give(w, u, 'casting', 1, 40, 'Iron');
  update item set piece = 'shovel_head' where id = v_head;
  perform pg_temp.skill(w, u, 'weaponsmithing', 2.3);
  perform pg_temp.skill(w, u, 'blacksmithing', 1);
  insert into said values ('SMITH_TIN2', ${refused(`forge_refusal(w, u, 'smith', jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_blade))`)});
  insert into said values ('SMITH_IRON1', ${refused(`forge_refusal(w, u, 'smith', jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_head))`)});
  perform pg_temp.skill(w, u, 'weaponsmithing', 10);
  insert into said values ('SMITH_TIN10', ${refused(`forge_refusal(w, u, 'smith', jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_blade))`)});
  insert into said values ('CAST_GATES', coalesce((casting_gate('sword_blade', 'Tin')).id, 'none') || ',' || coalesce((casting_gate('chain_coif', 'bronze')).id, 'none')
    || ',' || coalesce((casting_gate('bell_casting', 'Iron')).id, 'none') || ',' || coalesce((casting_gate('nail', 'Iron')).id, 'none'));

  /* ---- a stone in a circlet ---- */
  perform give(w, u, 'file', 1, 40, null);
  perform give(w, u, 'circlet', 1, 40, null);
  v_gem := give(w, u, 'gem', 1, 40, 'Diamond');
  v_topaz := give(w, u, 'gem', 1, 40, 'Topaz');
  perform pg_temp.skill(w, u, 'jewellery', 59);
  insert into said values ('DIAMOND59', ${refused(`item_refusal(w, u, 'set_in_circlet', jsonb_build_object('kind', 'item', 'uid', v_gem))`)});
  insert into said values ('TOPAZ59', ${refused(`item_refusal(w, u, 'set_in_circlet', jsonb_build_object('kind', 'item', 'uid', v_topaz))`)});
  perform pg_temp.skill(w, u, 'jewellery', 60);
  insert into said values ('DIAMOND60', ${refused(`item_refusal(w, u, 'set_in_circlet', jsonb_build_object('kind', 'item', 'uid', v_gem))`)});
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the table ------------------------------------------------------------ */

{
  const rows = SKILL_GATES.filter((g) => KINDS.includes(g.kind))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => `${g.kind}:${g.id}:${g.name}:${g.skill}:${g.level}`).join(',');
  check(`the island's batch F gates are the browser's, row for row (${rows.split(',').length})`, said('GATES') === rows,
    `island ${said('GATES').slice(0, 300)} / browser ${rows.slice(0, 300)}`);
  const items = GATED_ITEMS.filter((x) => KINDS.includes(x.gate.kind))
    .sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : a.extra < b.extra ? -1 : a.extra > b.extra ? 1 : 0))
    .map((x) => `${x.item}:${x.extra}:${x.gate.kind}:${x.gate.id}:${x.noun}`).join(',');
  check(`and their unidentified items: the lily root and a treasure map of each tier, no lotus seed (${items})`,
    said('ITEMS') === items && items.includes('lily_root::water_plant:lily:root') && !items.includes('lotus_seed')
      && TREASURE_TIERS.every((t) => items.includes(`treasure_map:${t.id}:hoard:${t.id}:map`)), `island ${said('ITEMS')}`);
  const mined = METALS.filter((m) => m.ore);
  check(`smelting a mined metal's ore at its pouring level, in ${SMELT_SKILL} (${mined.map((m) => `${m.id} ${gateOf('smelt', m.id)?.level}`).join(', ')})`,
    mined.every((m) => gateOf('smelt', m.id)?.level === gateOf('metal', m.id)?.level && gateOf('smelt', m.id)?.skill === SMELT_SKILL)
      && gateOf('smelt', 'copper')?.level === 1 && gateOf('smelt', 'iron')?.level === 1 && gateOf('smelt', 'tin')?.level === 10
      && gateOf('smelt', 'seryll')?.level === 90 && !METALS.filter((m) => !m.ore).some((m) => gateOf('smelt', m.id)));
  check(`working a casting at the smelting gate of its metal, in each trade a casting is worked in (${CASTING_SKILLS.join(', ')}): one table, METAL_GATE`,
    CASTING_SKILLS.every((s) => METALS.every((m) => gateOf('casting', castingGateId(s, m.id))?.level === METAL_GATE[m.id]
      && gateOf('casting', castingGateId(s, m.id))?.skill === s
      && (!m.ore || gateOf('casting', castingGateId(s, m.id))?.level === gateOf('smelt', m.id)?.level)))
      && ['weaponsmithing', 'armorsmithing', 'chainsmithing', 'platesmithing', MOULD_SKILL, 'jewellery'].every((s) => CASTING_SKILLS.includes(s))
      && gateOf('casting', 'weaponsmithing:bronze')?.level === 10 && gateOf('casting', 'platesmithing:electrum')?.level === 20 && gateOf('casting', 'blacksmithing:steel')?.level === 20,
    CASTING_SKILLS.join(','));
  const castIds = [castingGate('sword_blade', 'Tin')?.id, castingGate('chain_coif', 'bronze')?.id, castingGate('bell_casting', 'Iron')?.id, castingGate('nail', 'Iron')?.id]
    .map((x) => x ?? 'none').join(',');
  check(`a casting's gate by its piece and metal, none for a piece cast whole, on both sides (${castIds})`,
    castIds === 'weaponsmithing:tin,chainsmithing:bronze,none,blacksmithing:iron' && said('CAST_GATES') === castIds, `island ${said('CAST_GATES')}`);
  check('treasure maps by tier in digging: worn 1, sound 20, fine 40, grand 60',
    TREASURE_TIERS.map((t) => gateOf('hoard', t.id)?.level).join(',') === '1,20,40,60' && MAP_GATE_PER_TIER === 20 && gateOf('hoard', 'sound')?.skill === 'digging');
  check('bridges: the garden footbridge 10, the rope bridge 20, the drawbridge 50 by difficulty, in carpentry; a material bridge at its material\'s gate; the aqueduct 70 in masonry',
    gateOf('bridge', 'footbridge')?.level === 10 && gateOf('bridge', 'rope')?.level === 20 && gateOf('bridge', 'draw')?.level === 50
      && gateOf('bridge', 'log')?.level === gateOf('material', 'log')?.level && gateOf('bridge', 'plank')?.level === 10 && gateOf('bridge', 'timbercraft')?.level === 20
      && gateOf('bridge', 'marble')?.level === 50 && gateOf('bridge', 'stone_brick')?.level === 10 && gateOf('bridge', 'aqueduct')?.level === 70
      && gateOf('bridge', 'aqueduct')?.skill === 'masonry' && Object.keys(BRIDGES).every((k) => gateOf('bridge', k)?.skill === BRIDGES[k as keyof typeof BRIDGES].skill));
  check(`stones in a circlet by rarity, from the circlet's own ${recipeLevel(RECIPE_BY_ID.get('make_circlet')!)}: ${GEMS.map((s) => `${s.id} ${gemLevel(s)}`).join(', ')}`,
    gateOf('gem', 'topaz')?.level === 30 && gateOf('gem', 'amber')?.level === 30 && gateOf('gem', 'emerald')?.level === 40 && gateOf('gem', 'jasper')?.level === 40
      && gateOf('gem', 'ruby')?.level === 50 && gateOf('gem', 'opal')?.level === 50 && gateOf('gem', 'diamond')?.level === 60);
  check('Graft at forestry 50, a cross at animal husbandry 50, the water lily 10 and the lotus 20 in botanizing, the spells at their levels',
    gateOf('graft', 'graft')?.level === 50 && gateOf('graft', 'graft')?.skill === 'forestry' && gateOf('cross', 'cross')?.level === 50
      && gateOf('water_plant', 'lily')?.level === 10 && gateOf('water_plant', 'lotus')?.level === 20 && gateOf('spell', 'pyre')?.level === 30
      && gateOf('spell', 'pyre')?.skill === 'kindling' && gateOf('spell', 'snare')?.level === 1 && gateOf('spell', 'bulwark')?.skill === 'warding');
  const lowered = LOWERED.map((id) => `${id}:${gateOf('recipe', id)?.level}`).sort().join(',');
  check(`a trade's first steps at 1: ${LOWERED.join(', ')}, on both sides`,
    LOWERED.every((id) => gateOf('recipe', id)?.level === 1) && said('LOWERED') === lowered, `island ${said('LOWERED')} / browser ${lowered}`);
}

/* ---- the browser's ground ------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(SEED, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 3.5;
  g.player.y = T + 1.5;
  return g;
};
const ask = (g: Game, id: string, t: Target): string => ACTION_BY_ID.get(id)?.check?.(t, g) ?? 'ALLOWED';
const set = (g: Game, skill: string, v: number): void => { g.skills.values.set(skill, v); };
const isGate = (s: string): boolean => /: needs [a-z ]+ \d+; have \d+\.\d\.$/.test(s);

/* ---- the first steps ---------------------------------------------------------- */

{
  const words = LOWERED.map((id) => said(`LOW_${id}`));
  check(`at 1 in each trade the first steps are past the gate on the island (to what they are short of): ${words.join(' | ')}`,
    words.every((s) => s !== '' && !isGate(s)), words.join(' | '));
}

/* ---- Graft, a cross, a spell ---------------------------------------------------------- */

{
  const g = fresh();
  g.world.setTile(GX, GY, TileType.Tree, packTreeData(OAK, MATURE));
  g.inventory.add('sprout', { ql: 50, extra: 'Apple' });
  g.inventory.add('carving_knife', { ql: 40 });
  set(g, 'forestry', 49);
  const words = 'Graft: needs forestry 50; have 49.0.';
  const g49 = ask(g, 'graft', { kind: 'tile', x: GX, y: GY } as Target);
  set(g, 'forestry', 50);
  const g50 = ask(g, 'graft', { kind: 'tile', x: GX, y: GY } as Target);
  check(`Graft at forestry 49: "${words}" on both sides; at 50, past it`,
    g49 === words && said('GRAFT49') === words && !isGate(g50) && !isGate(said('GRAFT50')), `island "${said('GRAFT49')}" "${said('GRAFT50')}" / browser "${g49}" "${g50}"`);
  set(g, 'animal_husbandry', 49);
  const cross = 'Cross: needs animal husbandry 50; have 49.0.';
  check(`a listed cross at animal husbandry 49: "${cross}" on both sides`, kindRefusal(g, 'cross', 'cross') === cross && said('CROSS49') === cross,
    `island "${said('CROSS49')}"`);
  const pyre = 'Pyre: needs kindling 30; have 12.0.';
  const p12 = spellRefusal(spellDef('pyre')!, 'kindling', 12, { ql: 50, dmg: 0 });
  check(`Pyre at kindling 12: "${pyre}" on both sides; Ember open`, p12 === pyre && said('PYRE12') === pyre && said('EMBER12') === 'ALLOWED'
    && spellRefusal(spellDef('ember')!, 'kindling', 12, { ql: 50, dmg: 0 }) === null, `island "${said('PYRE12')}" / browser "${p12}"`);
}

/* ---- water plants ----------------------------------------------------------------- */

{
  const g = fresh();
  const root = g.inventory.add('lily_root', { ql: 30 });
  const seeds = g.inventory.add('lotus_seed', { ql: 30 });
  const lily = WATER_PLANT_BY_ID.get('lily')!;
  const lotus = WATER_PLANT_BY_ID.get('lotus')!;
  set(g, 'botanizing', 5);
  const no = 'Unidentified root: needs botanizing 10; have 5.0.';
  const tip = '10 botanizing required to identify this root.';
  check(`a lily root at botanizing 5: "Unidentified root", "${tip}", planting "${no}", on both sides`,
    seenName(root, g) === 'Unidentified root' && said('LILY5_NAME') === 'Unidentified root' && identifySaid(root, g) === tip && said('LILY5_TIP') === tip
      && waterPlantGateRefusal(g, lily) === no && said('LILY5') === no && itemGateRefusal(root, g) === no,
    `island ${said('LILY5_NAME')} "${said('LILY5_TIP')}" "${said('LILY5')}" / browser ${seenName(root, g)} "${waterPlantGateRefusal(g, lily)}"`);
  set(g, 'botanizing', 15);
  const lo = 'Lotus: needs botanizing 20; have 15.0.';
  check(`at 15 the lily root named and planted; lotus seeds always named, planting them "${lo}"; on both sides`,
    seenName(root, g) === said('LILY15_NAME') && !said('LILY15_NAME').startsWith('Unidentified') && said('LILY15') === 'ALLOWED' && waterPlantGateRefusal(g, lily) === null
      && seenName(seeds, g) === said('LOTUS15_NAME') && !said('LOTUS15_NAME').startsWith('Unidentified')
      && waterPlantGateRefusal(g, lotus) === lo && said('LOTUS15') === lo && said('LOTUS20') === 'ALLOWED',
    `island ${said('LILY15_NAME')} ${said('LILY15')} ${said('LOTUS15_NAME')} "${said('LOTUS15')}" ${said('LOTUS20')}`);
  const roots = (lv: number): string => [lily.from, lotus.from].filter((id) => workerWaterPlantOpen({ skills: { botanizing: lv } }, id)).join(',');
  check('a water planter at its own botanizing: nothing at 1, the lily root at 10, both at 20, on both sides',
    roots(1) === '' && said('ROOTS1') === '' && roots(10) === 'lily_root' && said('ROOTS10') === 'lily_root' && roots(20) === 'lily_root,lotus_seed'
      && said('ROOTS20') === roots(20), `island "${said('ROOTS1')}" ${said('ROOTS10')} ${said('ROOTS20')}`);
  const idle = idleSays({ why: 'gate', n: 0, what: ['water_plant', 'lily'] }, 'lily', null, 1, { botanizing: 1 });
  check(`and with only roots over its level in the stores: "${idle}"`, idle === 'Idle: Water lily in your settlement stores needs botanizing 10 (yours 1.0).', idle);
}

/* ---- a treasure map ------------------------------------------------------------------ */

{
  const g = fresh();
  g.inventory.add('shovel', { ql: 40 });
  const map = g.inventory.add('treasure_map', { ql: 30, extra: 'sound' });
  set(g, 'digging', 4);
  const no = 'Unidentified map: needs digging 20; have 4.0.';
  const tip = '20 digging required to identify this map.';
  const d4 = ask(g, 'unearth', { kind: 'item', uid: map.uid } as Target);
  check(`a sound map at digging 4: "Unidentified map", "${tip}", Dig it up "${no}" on both sides; Read not refused by it (batch G)`,
    seenName(map, g) === 'Unidentified map' && said('MAP4_NAME') === 'Unidentified map' && identifySaid(map, g) === tip && said('MAP4_TIP') === tip
      && d4 === no && said('MAP4_DIG') === no && said('MAP4_READ') !== no && !said('MAP4_READ').includes('needs digging'),
    `island ${said('MAP4_NAME')} "${said('MAP4_TIP')}" "${said('MAP4_DIG')}" "${said('MAP4_READ')}" / browser ${seenName(map, g)} "${d4}"`);
  set(g, 'digging', 20);
  const d20 = ask(g, 'unearth', { kind: 'item', uid: map.uid } as Target);
  check('at 20, named, and Dig it up past the gate (its hoard is the island\'s), on both sides',
    seenName(map, g) === said('MAP20_NAME') && !said('MAP20_NAME').startsWith('Unidentified') && !isGate(d20) && !isGate(said('MAP20_DIG')),
    `island ${said('MAP20_NAME')} "${said('MAP20_DIG')}" / browser ${seenName(map, g)} "${d20}"`);
  const worn = g.inventory.add('treasure_map', { ql: 10, extra: 'worn' });
  set(g, 'digging', 1);
  check('a worn map is known at digging 1', seenName(worn, g) !== 'Unidentified map');
}

/* ---- bridges and an aqueduct ------------------------------------------------------------ */

{
  const g = fresh();
  g.inventory.add('mallet', { ql: 40 });
  g.inventory.add('trowel', { ql: 40 });
  set(g, 'carpentry', 49);
  const draw = 'Drawbridge: needs carpentry 50; have 49.0.';
  const d49 = ask(g, 'plan_bridge', { kind: 'tile', x: T + 8, y: T + 1, material: 'draw' } as Target);
  set(g, 'carpentry', 50);
  const d50 = ask(g, 'plan_bridge', { kind: 'tile', x: T + 8, y: T + 1, material: 'draw' } as Target);
  check(`a drawbridge at carpentry 49: "${draw}" on both sides; at 50, past it`,
    d49 === draw && said('DRAW49') === draw && !isGate(d50) && !isGate(said('DRAW50')), `island "${said('DRAW49')}" "${said('DRAW50')}" / browser "${d49}" "${d50}"`);
  set(g, 'masonry', 9);
  const brick = 'Stone brick bridge: needs masonry 10; have 9.0.';
  const b9 = ask(g, 'plan_bridge', { kind: 'tile', x: T + 8, y: T + 1, material: 'stone_brick' } as Target);
  check(`a stone brick bridge at masonry 9: "${brick}", its material's gate, on both sides`, b9 === brick && said('BRICK9') === brick && bridgeGateRefusal(g, 'stone_brick') === brick,
    `island "${said('BRICK9')}" / browser "${b9}"`);
  set(g, 'masonry', 69);
  const aq = 'Aqueduct: needs masonry 70; have 69.0.';
  const a69 = ask(g, 'plan_aqueduct', { kind: 'tile', x: T + 5, y: T + 1, head: [T + 6, T + 1] } as Target);
  set(g, 'masonry', 70);
  const a70 = ask(g, 'plan_aqueduct', { kind: 'tile', x: T + 5, y: T + 1, head: [T + 6, T + 1] } as Target);
  check(`an aqueduct at masonry 69: "${aq}" on both sides; at 70, past it`,
    a69 === aq && said('AQ69') === aq && !isGate(a70) && !isGate(said('AQ70')), `island "${said('AQ69')}" "${said('AQ70')}" / browser "${a69}" "${a70}"`);
  check(`adding to a drawbridge's plan at carpentry 49: "${draw}" on the island`, said('BUILD49') === draw, said('BUILD49'));
  const span = { kind: 'span', bridge: { kind: 'draw' } as Bridge, span: {} as BridgeSpan } as const;
  const lv = (masonry: number, carpentry: number): number => creatureLevel({ species: 'cobbe', skills: { masonry, carpentry } });
  check('a Brickling fits a drawbridge\'s span (carpentry 50) only at level 50: not at masonry 30 or at masonry 1, carpentry 50; at masonry 50, carpentry 1; on both sides',
    !hodMay(lv(30, 1), span) && !hodMay(lv(1, 50), span) && hodMay(lv(50, 1), span)
      && said('HOD_SPAN30') === 'false' && said('HOD_SPAN_C50') === 'false' && said('HOD_SPAN50') === 'true',
    `island ${said('HOD_SPAN30')} ${said('HOD_SPAN_C50')} ${said('HOD_SPAN50')}`);
}

/* ---- smelting and working a casting --------------------------------------------------- */

{
  const g = fresh();
  const smelter = g.addSmelter(SX, SY, 0, 0, 50);
  smelter.fuel = 600;
  smelter.lit = true;
  const anvil = g.addAnvil(AX, AY, 0, 0, 'iron', 50);
  const tin = g.inventory.add('tin_ore', { ql: 40, count: 5 });
  const copper = g.inventory.add('copper_ore', { ql: 40, count: 5 });
  const smelt = (uid: number): Target => ({ kind: 'smelter', id: smelter.id, itemUid: uid } as Target);
  set(g, 'smelting', 2.3);
  const words = 'Tin smelting: needs smelting 10; have 2.3.';
  const s2 = ask(g, 'smelt_ore', smelt(tin.uid));
  const c2 = ask(g, 'smelt_ore', smelt(copper.uid));
  set(g, 'smelting', 10);
  const s10 = ask(g, 'smelt_ore', smelt(tin.uid));
  check(`smelting tin ore at smelting 2.3: "${words}" on both sides; copper at 2.3 and tin at 10, past it`,
    s2 === words && said('SMELT_TIN2') === words && !isGate(c2) && !isGate(said('SMELT_COPPER2')) && s10 === 'ALLOWED' && said('SMELT_TIN10') === 'ALLOWED',
    `island "${said('SMELT_TIN2')}" ${said('SMELT_COPPER2')} ${said('SMELT_TIN10')} / browser "${s2}" ${c2} ${s10}`);
  const ores = (lv: number): string => METALS.filter((m) => m.ore && workerSmeltOpen({ skills: { smelting: lv } }, m.ore)).map((m) => m.ore).join(',');
  check(`a smelter worker or a stoker charges only ore its own smelting smelts: ${ores(1)} at 1, ${ores(10)} at 10, on both sides; a kiln's greenware as it was`,
    ores(1) === 'copper_ore,iron_ore' && said('SMELTER1') === ores(1) && said('SMELTER10') === ores(10) && said('KILN1') === 'true',
    `island ${said('SMELTER1')} / ${said('SMELTER10')} ${said('KILN1')}`);
  const idle = idleSays({ why: 'gate', n: 0, what: ['smelt', 'tin'] }, 'smelt', null, 1, { smelting: 1 });
  check(`and with only tin ore in the stores: "${idle}"`, idle === 'Idle: Tin smelting in your settlement stores needs smelting 10 (yours 1.0).', idle);

  g.inventory.add('hammer', { ql: 40 });
  const blade = g.inventory.add('casting', { ql: 40, extra: 'Tin', piece: 'sword_blade' });
  const head = g.inventory.add('casting', { ql: 40, extra: 'Iron', piece: 'shovel_head' });
  const at = (uid: number): Target => ({ kind: 'anvil', id: anvil.id, itemUid: uid } as Target);
  set(g, 'weaponsmithing', 2.3);
  set(g, 'blacksmithing', 1);
  const cast = 'Tin casting: needs weaponsmithing 10; have 2.3.';
  const t2 = ask(g, 'smith', at(blade.uid));
  const i1 = ask(g, 'smith', at(head.uid));
  set(g, 'weaponsmithing', 10);
  const t10 = ask(g, 'smith', at(blade.uid));
  check(`working a tin sword blade casting at weaponsmithing 2.3: "${cast}" on both sides, at tin's smelting level; at 10, past it`,
    t2 === cast && said('SMITH_TIN2') === cast && t10 === 'ALLOWED' && said('SMITH_TIN10') === 'ALLOWED' && gateOf('casting', 'weaponsmithing:tin')?.level === gateOf('smelt', 'tin')?.level,
    `island "${said('SMITH_TIN2')}" ${said('SMITH_TIN10')} / browser "${t2}" ${t10}`);
  check('an iron shovel head casting at blacksmithing 1: past it, on both sides', i1 === 'ALLOWED' && said('SMITH_IRON1') === 'ALLOWED', `island ${said('SMITH_IRON1')} / browser ${i1}`);
}

/* ---- a stone in a circlet ------------------------------------------------------------- */

{
  const g = fresh();
  g.inventory.add('file', { ql: 40 });
  g.inventory.add('circlet', { ql: 40 });
  const diamond = g.inventory.add('gem', { ql: 40, extra: 'Diamond' });
  const topaz = g.inventory.add('gem', { ql: 40, extra: 'Topaz' });
  set(g, 'jewellery', 59);
  const words = 'Diamond setting: needs jewellery 60; have 59.0.';
  const d59 = ask(g, 'set_in_circlet', { kind: 'item', uid: diamond.uid } as Target);
  const t59 = ask(g, 'set_in_circlet', { kind: 'item', uid: topaz.uid } as Target);
  set(g, 'jewellery', 60);
  const d60 = ask(g, 'set_in_circlet', { kind: 'item', uid: diamond.uid } as Target);
  check(`a diamond in a circlet at jewellery 59: "${words}" on both sides; a topaz at 59 and the diamond at 60, set`,
    d59 === words && said('DIAMOND59') === words && t59 === 'ALLOWED' && said('TOPAZ59') === 'ALLOWED' && d60 === 'ALLOWED' && said('DIAMOND60') === 'ALLOWED',
    `island "${said('DIAMOND59')}" ${said('TOPAZ59')} ${said('DIAMOND60')} / browser "${d59}" ${t59} ${d60}`);
}

/* ---- the Skills window ------------------------------------------------------------ */

{
  const shown = (skill: string, have: number): string => unlocksOf(skill, have).map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(', ');
  check(`digging's Unlocks: the maps by tier (${shown('digging', 20)})`,
    TREASURE_TIERS.every((t) => unlocksOf('digging', 20).some((u) => u.name === `${t.name.charAt(0).toUpperCase()}${t.name.slice(1)}` && u.met === (u.level <= 20))));
  check(`smelting's Unlocks: each metal's smelting with the alloys (${shown('smelting', 10).slice(0, 200)})`,
    METALS.filter((m) => m.ore).every((m) => unlocksOf('smelting', 10).some((u) => u.name === `${m.name} smelting` && u.level === METAL_GATE[m.id])));
  check(`jewellery's Unlocks: the settings (${shown('jewellery', 40).slice(0, 200)})`,
    GEMS.every((s) => unlocksOf('jewellery', 40).some((u) => u.name === `${s.name} setting` && u.level === gemLevel(s) && u.met === (gemLevel(s) <= 40))));
  check('botanizing\'s: Water lily 10, Lotus 20; forestry\'s Graft 50; animal husbandry\'s Cross 50; kindling\'s Ember 1, Pyre 30',
    shown('botanizing', 10) === '✓Water lily 10, ·Lotus 20' && unlocksOf('forestry', 1).some((u) => u.name === 'Graft' && u.level === 50)
      && unlocksOf('animal_husbandry', 1).some((u) => u.name === 'Cross' && u.level === 50) && shown('kindling', 1) === '✓Ember 1, ·Pyre 30',
    `${shown('botanizing', 10)} / ${shown('kindling', 1)}`);
  const rows = unlockRows('weaponsmithing', 10);
  check(`weaponsmithing's casting metals as rows a level (${rows.map((r) => r.label).join(' | ').slice(0, 200)})`,
    unlocksOf('weaponsmithing', 10).length > UNLOCKS_GROUPED_OVER && rows.some((r) => r.level === 10 && r.met && r.names.includes('Tin casting')));
  check(`carpentry's and masonry's Unlocks name the bridges (${['Drawbridge', 'Rope bridge', 'Garden footbridge'].join(', ')}; Aqueduct)`,
    ['Drawbridge', 'Rope bridge', 'Garden footbridge', 'Log bridge'].every((n) => unlocksOf('carpentry', 1).some((u) => u.name === n))
      && unlocksOf('masonry', 1).some((u) => u.name === 'Aqueduct' && u.level === 70));
}

finish('Skill gates: the recommended gates, smelting and castings by the metal, first steps at 1');
