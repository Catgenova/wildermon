/**
 * Skill gates: one rule; trees, sprouts and crops on it; a worker at its own level in the gate's skill; and items
 * unidentified under the gate on their use.
 *
 * Asked for: "cutting trees is similarly gated, with willow requiring the highest level and pine the least. Oak birch
 * and maple early on", then "Birch 1. Willow 90."; sowing gated per crop and sprouts per species, for players and the
 * workers that sow and plant; a worker checking a gate's own skill at its own level in that skill; and "items picked up
 * that you cant use yet show as "unidentified ", e.g. a player with 20 farming sees "unidentified seed" for a wemp
 * seed. Tooltip shows just "30 farming required to identify this seed"". Asked of the island and of the browser:
 *
 *   * the island's `skill_gate` and `skill_gate_item` are the browser's `SKILL_GATES` and `GATED_ITEMS`, row for row:
 *     every tree species placed, pine and birch at 1, oak and maple early, willow alone at 90; sprouts a ladder step
 *     under their felling; the crops as asked; every level on the ladder;
 *   * you at woodcutting 12.4 beside a mature willow: refused in the same words on both sides, "Willow: needs
 *     woodcutting 90; have 12.4."; at 90, allowed; a willow sapling, with no logs, anybody clears;
 *   * a Sapgnaw at woodcutting 1 by a mature willow does not take it and says why; by a pine as well, it takes the pine;
 *   * a hod carrier at masonry 90 reads a woodcutting gate at its woodcutting, 1, not its trade's 90, on both sides;
 *   * the lowest crop still gated above farming 1's seeds in a crate (wemp was the example; it came down to 1, batch G),
 *     the tooltip "5 farming required to identify this seed." and nothing else for the first, on both sides; picked
 *     up, "Picked up: 2 × unidentified seed." and "Picked up: 2 × cabbage seeds."; examined, the tooltip's words;
 *   * sowing them under the gate: "Unidentified seed: needs farming 5; have 1.0." on both sides, at it allowed; an
 *     onion at 1 allowed; a ripe wemp crop harvested at farming 1: allowed;
 *   * a willow sprout at forestry 1: picking off a willow and planting one refused on both sides, a pine's allowed;
 *   * a farmer at farming 1 sows onion and passes wemp by, a sprout picker passes a willow by and says why;
 *   * the Skills window's Unlocks for woodcutting and farming are the table in level order, ticked by your level;
 *   * decided since: the Guiding Light's suggested sites count only the trees your woodcutting fells (birch and oak
 *     stripes: birch only at 1, both at 5, none with every stripe oak at 1), and its site step says which, from the gates.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { FARM_ACTION_BY_ID } from '../../src/game/farming';
import { GATHER_SKILL, type Creature } from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';
import { creatureLines } from '../../src/ui/creatureinfo';
import { itemCard } from '../../src/ui/compare';
import {
  cropSeed, CROP_GATE, GATE_LADDER, GATED_ITEMS, gateOf, identifySaid, itemGateRefusal, KEPT_OFF_LADDER, seenName, skillGateRefusal, nextUnlockSaid,
  SKILL_GATES, unlocksOf, workerGateOpen, workerItemOpen,
} from '../../src/game/skillgates';
import { packTreeData, TileType, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';
import { fellsSaid, PATH_STEP_BY_ID } from '../../src/game/path';
import type { PathSite } from '../../src/game/pathstate';
import { psql, check, finish } from './harness';
import { itemDef } from '../../src/game/items';

const U = '7e5b0000-0000-4000-8000-0000000a7e01';
const U2 = '7e5b0000-0000-4000-8000-0000000a7e02';
const T = 40;
const species = (name: string): number => TREE_DEFS.findIndex((t) => t.name === name);
const WILLOW = species('Willow');
const PINE = species('Pine');
const MATURE = TREE_AGES.findIndex((a) => a.name === 'Mature');
const SAPLING = TREE_AGES.findIndex((a) => a.logs === 0 && a.alive);
const NEED = gateOf('tree', 'willow')!.level;
const SPROUT_NEED = gateOf('sprout', 'willow')!.level;
/** The seed the unidentified checks ask of: the lowest crop sown above farming 1 (wemp came down to 1, batch G), by name. */
const GATED_CROP = Object.entries(CROP_GATE).filter(([, lv]) => lv > 1).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))[0][0];
const WEMP = cropSeed(GATED_CROP);
const WEMP_NEED = gateOf('crop', GATED_CROP)!.level;
/** Under it, and its seed's name as somebody at it reads it. */
const UNDER = 1;
const SEEDS = itemDef(WEMP).name;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.run(w uuid, p_id int, n int) returns void language plpgsql as $r$
declare i int;
begin
  for i in 1..n loop
    update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
           leg_at = now() - interval '61 seconds', leg_ends = now() - interval '60 seconds', from_x = to_x, from_y = to_y,
           worn = 0, hunger = 1
     where world_id = w and id = p_id and mode = 'deed';
    perform worker_settle(w, p_id);
  end loop;
end $r$;
create function pg_temp.worker(w uuid, u uuid, p_kind text, p_trade text, p_skills jsonb) returns int language plpgsql as $m$
declare v int; j jsonb;
begin
  v := creature_spawn(w, p_kind, ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip', skills = p_skills where world_id = w and id = v;
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v));
  update creature set job = p_trade where world_id = w and id = v;
  return v;
end $m$;
create function pg_temp.idle(w uuid, p_id int) returns text language sql as $i$
  select coalesce(idle_why, '') || '|' || coalesce(round(idle_n::numeric)::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = $1 and id = $2;
$i$;
create function pg_temp.skill(w uuid, u uuid, s text, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, s, v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
create function pg_temp.said_last(w uuid, u uuid) returns text language sql as $l$
  select text from event where world_id = w and uid = u order by n desc limit 1
$l$;
do $t$
declare w uuid; u uuid := '${U}'; u2 uuid := '${U2}'; v_m int; box int; v_it bigint; v_seed bigint; v_onion bigint; v_sp bigint;
        tile jsonb := jsonb_build_object('kind', 'tile', 'x', ${T + 3}, 'y', ${T});
begin
  insert into said select 'GATES', string_agg(kind || ':' || id || ':' || name || ':' || skill || ':' || level, ',' order by kind, id) from skill_gate;
  insert into said select 'ITEMS', string_agg(item || ':' || extra || ':' || kind || ':' || id || ':' || noun, ',' order by item, extra) from skill_gate_item;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates', 306, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform land_set_dirt(w, x, y, 14) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u2)::text, true);
  perform rpc_join(w, 'Other');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now() where world_id = w and uid in (u, u2);

  -- A mature willow three tiles off.
  perform land_set_tile(w, ${T + 3}, ${T}, tile_id('Tree'));
  perform land_set_data(w, ${T + 3}, ${T}, tree_pack(${WILLOW}, ${MATURE}));

  -- A feller at woodcutting 1: not taken, and why.
  v_m := pg_temp.worker(w, u, 'bevere', 'woodcut', jsonb_build_object('woodcutting', 1));
  insert into said select 'W1_MAY', worker_gatherable(w, ${T + 3}, ${T}, 'woodcut', c)::text from creature c where world_id = w and id = v_m;
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('W1', pg_temp.idle(w, v_m));
  insert into said select 'W1_SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->'idleWhat'->>0, '') || ',' || coalesce(e->'idleWhat'->>1, '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_m;
  -- And with a pine in reach as well, it goes to the pine.
  perform land_set_tile(w, ${T}, ${T + 5}, tile_id('Tree'));
  perform land_set_data(w, ${T}, ${T + 5}, tree_pack(${PINE}, ${MATURE}));
  perform pg_temp.run(w, v_m, 1);
  insert into said select 'W1_PINE', coalesce(work_x::text, '') || ',' || coalesce(work_y::text, '') || '|' || coalesce(idle_why, '')
    from creature where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;
  -- At its gate's level it takes the willow.
  v_m := pg_temp.worker(w, u, 'bevere', 'woodcut', jsonb_build_object('woodcutting', ${NEED}));
  insert into said select 'W90_MAY', worker_gatherable(w, ${T + 3}, ${T}, 'woodcut', c)::text from creature c where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;

  -- A sprout picker at forestry 1 passes the willow by, and says so; the pine it picks.
  v_m := pg_temp.worker(w, u, 'sprigga', 'sprout', jsonb_build_object('forestry', 1));
  insert into said select 'SP_WILLOW', worker_gatherable(w, ${T + 3}, ${T}, 'sprout', c)::text || '|' || worker_gatherable(w, ${T}, ${T + 5}, 'sprout', c)::text
    from creature c where world_id = w and id = v_m;
  perform land_set_tile(w, ${T}, ${T + 5}, tile_id('Grass'));
  perform land_set_data(w, ${T}, ${T + 5}, 0);
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('SP_IDLE', pg_temp.idle(w, v_m));
  delete from creature where world_id = w and id = v_m;

  -- A hod carrier at masonry 90 reads a woodcutting gate at its woodcutting.
  v_m := pg_temp.worker(w, u, 'cobbe', 'hod', jsonb_build_object('masonry', 90));
  insert into said select 'HOD', round(task_skill(c)::numeric)::text || '|' || worker_gate_open(c, skill_gate_of('tree', 'willow'))::text
      || '|' || worker_gate_open(c, skill_gate_of('tree', 'pine'))::text from creature c where world_id = w and id = v_m;
  update creature set skills = skills || jsonb_build_object('woodcutting', 90) where world_id = w and id = v_m;
  insert into said select 'HOD_WC', worker_gate_open(c, skill_gate_of('tree', 'willow'))::text from creature c where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;
  perform land_set_tile(w, ${T}, ${T + 5}, tile_id('Grass'));
  perform land_set_data(w, ${T}, ${T + 5}, 0);

  -- A farmer at farming 1: wemp seed in the furrow passed by, onion sown.
  v_m := pg_temp.worker(w, u, 'seavic', 'farm', jsonb_build_object('farming', 1));
  insert into said select 'FARM_SEEDS', array_to_string(worker_seeds(c), ',') from creature c where world_id = w and id = v_m;
  perform land_set_tile(w, ${T + 6}, ${T + 6}, tile_id('Field'));
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count) values (w, 'ground', ${T + 6}, ${T + 6}, '${WEMP}', 20, 0, 2);
  insert into said select 'FARM_WEMP', coalesce((sow_seed(w, c, ${T + 6}, ${T + 6})).def, 'none') from creature c where world_id = w and id = v_m;
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count) values (w, 'ground', ${T + 6}, ${T + 6}, 'onion_seed', 20, 0, 2);
  insert into said select 'FARM_ONION', coalesce((sow_seed(w, c, ${T + 6}, ${T + 6})).def, 'none') from creature c where world_id = w and id = v_m;
  delete from item where world_id = w and holder = 'ground' and gx = ${T + 6};
  delete from creature where world_id = w and id = v_m;

  -- You, beside the willow, with a hatchet.
  perform give(w, u, 'hatchet', 1, 40, null);
  update player set x = ${T + 2}.5, y = ${T}.5 where world_id = w and uid = u;
  perform pg_temp.skill(w, u, 'woodcutting', 12.4);
  insert into said values ('YOU12', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));
  perform pg_temp.skill(w, u, 'woodcutting', ${NEED});
  insert into said values ('YOU90', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));
  -- Picking a sprout off it at forestry 1, and at its level.
  perform pg_temp.skill(w, u, 'forestry', 1);
  insert into said values ('PICK1', coalesce(act_refusal(w, u, 'pick_sprout', tile), 'none'));
  perform pg_temp.skill(w, u, 'forestry', ${SPROUT_NEED});
  insert into said values ('PICK80', coalesce(act_refusal(w, u, 'pick_sprout', tile), 'none'));
  -- A sapling, with no logs in it, at 1.
  perform pg_temp.skill(w, u, 'woodcutting', 1);
  perform land_set_data(w, ${T + 3}, ${T}, tree_pack(${WILLOW}, ${SAPLING}));
  insert into said values ('SAPLING', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));

  -- Planting a willow sprout at forestry 1, and a pine one, beside the tile.
  perform pg_temp.skill(w, u, 'forestry', 1);
  update player set x = ${T + 1}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  v_sp := give(w, u, 'sprout', 1, 30, 'Willow');
  insert into said values ('PLANT_WILLOW', coalesce(act_refusal(w, u, 'plant', jsonb_build_object('kind', 'tile', 'x', ${T + 2}, 'y', ${T + 2}, 'itemUid', v_sp)), 'none'));
  insert into said values ('SEEN_SPROUT', seen_name(w, u, (select i from item i where i.id = v_sp)));
  v_sp := give(w, u, 'sprout', 1, 30, 'Pine');
  insert into said values ('PLANT_PINE', coalesce(act_refusal(w, u, 'plant', jsonb_build_object('kind', 'tile', 'x', ${T + 2}, 'y', ${T + 2}, 'itemUid', v_sp)), 'none'));
  -- Nothing named: the pine, which your forestry plants, before the willow.
  insert into said values ('PLANT_ANY', coalesce(act_refusal(w, u, 'plant', jsonb_build_object('kind', 'tile', 'x', ${T + 2}, 'y', ${T + 2})), 'none'));

  -- The lowest gated crop's seeds in a crate on the settlement, seen by you under its gate and by the other at it.
  perform pg_temp.skill(w, u, 'farming', ${UNDER});
  perform pg_temp.skill(w, u2, 'farming', ${WEMP_NEED});
  select coalesce(max(id), 0) + 1 into box from crate where world_id = w;
  insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, box, 'plank', ${T}, ${T + 2}, 0, 0, true);
  v_it := give(w, u, '${WEMP}', 3, 20, null);
  update item set holder = 'crate', crate = box, holder_uid = null where id = v_it;
  insert into said select 'CRATE_20', string_agg(seen_name(w, u, i), ',' order by i.id) from item i where i.world_id = w and i.crate = box;
  insert into said select 'CRATE_40', string_agg(seen_name(w, u2, i), ',' order by i.id) from item i where i.world_id = w and i.crate = box;
  insert into said values ('TIP_20', coalesce(identify_said(w, u, '${WEMP}', null), 'none'));
  insert into said values ('TIP_40', coalesce(identify_said(w, u2, '${WEMP}', null), 'none'));
  insert into said select 'EXAMINE_20', examine_item_text(w, u, i) from item i where i.id = v_it;

  -- Picked up off the ground, by each.
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count) values (w, 'ground', ${T}, ${T + 1}, '${WEMP}', 20, 0, 2) returning id into v_it;
  perform perform_hands(w, u, 'pick_up', jsonb_build_object('kind', 'ground', 'x', ${T}, 'y', ${T + 1}, 'uid', v_it));
  insert into said values ('PICKED_20', pg_temp.said_last(w, u));
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count) values (w, 'ground', ${T}, ${T + 1}, '${WEMP}', 20, 0, 2) returning id into v_it;
  perform perform_hands(w, u2, 'pick_up', jsonb_build_object('kind', 'ground', 'x', ${T}, 'y', ${T + 1}, 'uid', v_it));
  insert into said values ('PICKED_40', pg_temp.said_last(w, u2));

  -- Sowing it, beside a field: under its gate and at it; an onion at 1.
  perform land_set_tile(w, ${T + 1}, ${T + 2}, tile_id('Field'));
  update player set x = ${T + 1}.5, y = ${T + 1}.5 where world_id = w and uid in (u, u2);
  select id into v_seed from item where world_id = w and holder = 'player' and holder_uid = u and def = '${WEMP}' order by id limit 1;
  insert into said values ('SOW_20', coalesce(act_refusal(w, u, 'plant_seed', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T + 2}, 'itemUid', v_seed)), 'none'));
  perform pg_temp.skill(w, u, 'farming', ${WEMP_NEED});
  insert into said values ('SOW_40', coalesce(act_refusal(w, u, 'plant_seed', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T + 2}, 'itemUid', v_seed)), 'none'));
  perform pg_temp.skill(w, u, 'farming', 1);
  v_onion := give(w, u, 'onion_seed', 1, 20, null);
  insert into said values ('SOW_ONION', coalesce(act_refusal(w, u, 'plant_seed', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T + 2}, 'itemUid', v_onion)), 'none'));
  -- A ripe wemp crop there, harvested at farming 1 with a sickle.
  perform give(w, u, 'sickle', 1, 40, null);
  insert into crop (world_id, x, y, id, stage, stage_at, tended, tended_now, ql, pace)
    values (w, ${T + 1}, ${T + 2}, 'wemp', crop_ripe(), now(), 0, false, 30, 1);
  insert into said values ('HARVEST_1', coalesce(act_refusal(w, u, 'harvest_crop', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T + 2})), 'none'));
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the defs -------------------------------------------------------------- */

{
  const mine = [...SKILL_GATES].sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : a.kind + a.id > b.kind + b.id ? 1 : 0))
    .map((g) => `${g.kind}:${g.id}:${g.name}:${g.skill}:${g.level}`).join(',');
  check('the island\'s skill_gate is the browser\'s SKILL_GATES, row for row', said('GATES') === mine, `island ${said('GATES')} / browser ${mine}`);
  const items = [...GATED_ITEMS].sort((a, b) => (a.item + a.extra < b.item + b.extra ? -1 : a.item + a.extra > b.item + b.extra ? 1 : 0))
    .map((x) => `${x.item}:${x.extra}:${x.gate.kind}:${x.gate.id}:${x.noun}`).join(',');
  check(`and skill_gate_item is GATED_ITEMS (${GATED_ITEMS.length}: every seed and every species' sprout)`, said('ITEMS') === items, `island ${said('ITEMS')} / browser ${items}`);
  const trees = TREE_DEFS.map((t) => gateOf('tree', t.name.toLowerCase()));
  check(`every tree species has a woodcutting gate (${TREE_DEFS.length})`, trees.every((g) => g?.skill === 'woodcutting'));
  const lv = (n: string): number => gateOf('tree', n.toLowerCase())!.level;
  const most = Math.max(...trees.map((g) => g!.level));
  check(`birch ${lv('Birch')} and pine ${lv('Pine')} at 1, willow ${lv('Willow')} at 90, alone at the top`,
    lv('Birch') === 1 && lv('Pine') === 1 && lv('Willow') === 90 && trees.filter((g) => g!.level >= most).length === 1);
  check(`oak ${lv('Oak')} and maple ${lv('Maple')}: early (10 or under)`, ['Oak', 'Maple'].every((n) => lv(n) <= 10));
  // Decided since: no empty step from 1 to 90; pine and birch 1, oak 5, maple 10 and willow 90 kept; cedar 70, olive 80.
  const empty = GATE_LADDER.filter((l) => l <= 90 && !trees.some((g) => g!.level === l));
  check(`every ladder step from 1 to 90 has a tree (${GATE_LADDER.map((l) => `${l}: ${TREE_DEFS.filter((t) => lv(t.name) === l).map((t) => t.name).join(', ')}`).join('; ')})`,
    !empty.length && lv('Oak') === 5 && lv('Maple') === 10 && lv('Pomegranate') === 60 && lv('Cedar') === 70 && lv('Olive') === 80,
    empty.join(', '));
  check('and their sprouts one step under: olive 70, cedar 60', gateOf('sprout', 'olive')!.level === 70 && gateOf('sprout', 'cedar')!.level === 60);
  const step = (l: number): number => GATE_LADDER[Math.max(0, GATE_LADDER.indexOf(l as (typeof GATE_LADDER)[number]) - 1)];
  check('every species\' sprout one ladder step under its felling (pine and birch 1, willow 80)',
    TREE_DEFS.every((t) => gateOf('sprout', t.name.toLowerCase())?.level === step(lv(t.name)) && gateOf('sprout', t.name.toLowerCase())?.skill === 'forestry')
      && gateOf('sprout', 'willow')!.level === 80);
  const asked: Record<string, number> = { onion: 1, carrot: 1, potato: 1, wemp: 1, cabbage: 5, wheat: 5, corn: 10, thyme: 10, cotton: 20, mint: 20, sage: 20, basil: 30, rosemary: 40 };
  check('the crops as asked: onion, carrot, potato and wemp (decided, batch G) 1; cabbage, wheat 5; corn, thyme 10; cotton, mint, sage 20; basil 30; rosemary 40',
    Object.entries(asked).every(([id, n]) => gateOf('crop', id)?.level === n && gateOf('crop', id)?.skill === 'farming') && Object.keys(CROP_GATE).length === 13);
  check('a wagon at driving 30, a large cart open', gateOf('vehicle', 'wagon')?.level === 30 && gateOf('vehicle', 'wagon')?.skill === 'driving' && !gateOf('vehicle', 'large_cart'));
  check(`every gate on the ladder (${GATE_LADDER.join(', ')})`, SKILL_GATES.every((g) => KEPT_OFF_LADDER.has(g.kind) || (GATE_LADDER as readonly number[]).includes(g.level)));
}

/* ---- you ------------------------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(306, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  w.dirt.fill(14);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  g.inventory.add('hatchet', { ql: 40 });
  g.player.x = T + 2.5;
  g.player.y = T + 0.5;
  const cut = ACTION_BY_ID.get('cut_down')!;
  const pick = ACTION_BY_ID.get('pick_sprout')!;
  const at = { kind: 'tile', x: T + 3, y: T } as Parameters<NonNullable<typeof cut.check>>[0];
  const words = skillGateRefusal('Willow', 'woodcutting', 12.4, NEED)!;
  g.skills.values.set('woodcutting', 12.4);
  const b12 = cut.check?.(at, g) ?? 'none';
  check(`you at woodcutting 12.4 by a mature willow: "${words}", the same on both sides (the menu's hint)`,
    b12 === words && said('YOU12') === words, `island "${said('YOU12')}" / browser "${b12}"`);
  g.skills.values.set('woodcutting', NEED);
  const b90 = cut.check?.(at, g) ?? 'none';
  check(`and at ${NEED}, allowed on both sides`, b90 === 'none' && said('YOU90') === 'none', `island ${said('YOU90')} / browser ${b90}`);
  g.skills.values.set('forestry', 1);
  const p1 = pick.check?.(at, g) ?? 'none';
  const pw = skillGateRefusal('Willow sprout', 'forestry', 1, SPROUT_NEED)!;
  check(`picking a sprout off it at forestry 1: "${pw}" on both sides`, p1 === pw && said('PICK1') === pw, `island "${said('PICK1')}" / browser "${p1}"`);
  g.skills.values.set('forestry', SPROUT_NEED);
  const p80 = pick.check?.(at, g) ?? 'none';
  check(`and at ${SPROUT_NEED}, allowed on both sides`, p80 === 'none' && said('PICK80') === 'none', `island ${said('PICK80')} / browser ${p80}`);
  g.skills.values.set('woodcutting', 1);
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, SAPLING));
  const bs = cut.check?.(at, g) ?? 'none';
  check('a willow sapling, no logs in it: anybody clears it, on both sides', bs === 'none' && said('SAPLING') === 'none', `island ${said('SAPLING')} / browser ${bs}`);
}
{
  // Planting a sprout at forestry 1.
  const g = fresh();
  g.skills.values.set('forestry', 1);
  g.player.x = T + 0.5;
  g.player.y = T + 0.5;
  const plant = ACTION_BY_ID.get('plant')!;
  const willow = g.inventory.add('sprout', { ql: 30, extra: 'Willow' });
  const tile = { kind: 'tile', x: T + 2, y: T + 2, cx: T + 2, cy: T + 2 } as const;
  const bw = plant.check?.({ ...tile, itemUid: willow.uid } as Target, g) ?? 'none';
  const words = skillGateRefusal('Unidentified sprout', 'forestry', 1, SPROUT_NEED)!;
  check(`a willow sprout at forestry 1, "${seenName(willow, g)}" on both sides; planting it: "${words}"`,
    bw === words && said('PLANT_WILLOW') === words && seenName(willow, g) === 'Unidentified sprout' && said('SEEN_SPROUT') === 'Unidentified sprout',
    `island "${said('PLANT_WILLOW')}" ${said('SEEN_SPROUT')} / browser "${bw}"`);
  const pine = g.inventory.add('sprout', { ql: 30, extra: 'Pine' });
  const bp = plant.check?.({ ...tile, itemUid: pine.uid } as Target, g) ?? 'none';
  const ba = plant.check?.(tile, g) ?? 'none';
  check('a pine sprout planted at forestry 1, and with none named the pine comes to hand first: allowed on both sides',
    bp === 'none' && said('PLANT_PINE') === 'none' && ba === 'none' && said('PLANT_ANY') === 'none',
    `island ${said('PLANT_PINE')} ${said('PLANT_ANY')} / browser ${bp} ${ba}`);
}

/* ---- unidentified, per viewer ------------------------------------------------ */

{
  const at20 = fresh();
  const at40 = fresh();
  at20.skills.values.set('farming', UNDER);
  at40.skills.values.set('farming', WEMP_NEED);
  // The same crate's stack, seen by each.
  const stack = { uid: 1, id: WEMP, ql: 20, dmg: 0, count: 3 };
  const tip = `${WEMP_NEED} farming required to identify this seed.`;
  check(`${SEEDS} in a crate at farming ${UNDER}: "${seenName(stack, at20)}", tooltip "${tip}", on both sides`,
    seenName(stack, at20) === 'Unidentified seed' && said('CRATE_20') === 'Unidentified seed'
      && identifySaid(stack, at20) === tip && said('TIP_20') === tip,
    `island ${said('CRATE_20')} "${said('TIP_20')}" / browser ${seenName(stack, at20)} "${identifySaid(stack, at20)}"`);
  check('the same crate at farming 40: "Wemp seeds", no tooltip of it, on both sides',
    seenName(stack, at40) === SEEDS && said('CRATE_40') === SEEDS && identifySaid(stack, at40) === null && said('TIP_40') === 'none',
    `island ${said('CRATE_40')} ${said('TIP_40')} / browser ${seenName(stack, at40)}`);
  const card = itemCard(at20, stack);
  check('the tooltip is that line and nothing else; examined on the island, the same words',
    card.length === 1 && card[0] === tip && said('EXAMINE_20') === tip, `${JSON.stringify(card)} / ${said('EXAMINE_20')}`);
  check(`and at farming ${WEMP_NEED} the card names it`, (itemCard(at40, stack)[0] as string).startsWith(SEEDS));

  // Picked up off the ground, by each.
  const heard = (g: Game): string[] => {
    const lines: string[] = [];
    g.logMsg = (m: string) => { lines.push(m); };
    return lines;
  };
  const up = ACTION_BY_ID.get('pick_up')!;
  const said20 = heard(at20);
  const said40 = heard(at40);
  for (const g of [at20, at40]) {
    g.dropOnGround(T, T + 1, { uid: g.inventory.nextUid++, id: WEMP, ql: 20, dmg: 0, count: 2 });
    up.perform({ kind: 'ground', x: T, y: T + 1, uid: null } as Parameters<typeof up.perform>[0], g);
  }
  check(`picked up at ${UNDER}: "Picked up: 2 × unidentified seed." on both sides`,
    said20.at(-1) === 'Picked up: 2 × unidentified seed.' && said('PICKED_20') === 'Picked up: 2 × unidentified seed.',
    `island "${said('PICKED_20')}" / browser "${said20.at(-1)}"`);
  check(`and at ${WEMP_NEED}: "Picked up: 2 × ${SEEDS.toLowerCase()}." on both sides`,
    said40.at(-1) === `Picked up: 2 × ${SEEDS.toLowerCase()}.` && said('PICKED_40') === `Picked up: 2 × ${SEEDS.toLowerCase()}.`,
    `island "${said('PICKED_40')}" / browser "${said40.at(-1)}"`);

  // Sown under its gate and at it, beside a field.
  const sow = FARM_ACTION_BY_ID.get('plant_seed')!;
  for (const g of [at20, at40]) {
    g.world.setTile(T + 1, T + 2, TileType.Field);
    g.player.x = T + 1.5;
    g.player.y = T + 1.5;
  }
  const seed20 = at20.inventory.items.find((it) => it.id === WEMP)!;
  const words = skillGateRefusal('Unidentified seed', 'farming', UNDER, WEMP_NEED)!;
  const s20 = sow.check?.({ kind: 'tile', x: T + 1, y: T + 2, itemUid: seed20.uid } as Parameters<NonNullable<typeof sow.check>>[0], at20) ?? 'none';
  check(`sowing it at farming ${UNDER}: "${words}" on both sides (the seed named as you see it)`,
    s20 === words && said('SOW_20') === words && itemGateRefusal(seed20, at20) === words, `island "${said('SOW_20')}" / browser "${s20}"`);
  const seed40 = at40.inventory.items.find((it) => it.id === WEMP)!;
  const s40 = sow.check?.({ kind: 'tile', x: T + 1, y: T + 2, itemUid: seed40.uid } as Parameters<NonNullable<typeof sow.check>>[0], at40) ?? 'none';
  check(`and at ${WEMP_NEED}, allowed on both sides`, s40 === 'none' && said('SOW_40') === 'none', `island ${said('SOW_40')} / browser ${s40}`);
  const at1 = fresh();
  at1.world.setTile(T + 1, T + 2, TileType.Field);
  at1.player.x = T + 1.5;
  at1.player.y = T + 1.5;
  const onion = at1.inventory.add(cropSeed('onion'), { ql: 20 });
  const s1 = sow.check?.({ kind: 'tile', x: T + 1, y: T + 2, itemUid: onion.uid } as Parameters<NonNullable<typeof sow.check>>[0], at1) ?? 'none';
  check('an onion at farming 1: allowed on both sides', s1 === 'none' && said('SOW_ONION') === 'none', `island ${said('SOW_ONION')} / browser ${s1}`);
  // A ripe wemp crop, harvested at farming 1.
  at1.inventory.add('sickle', { ql: 40 });
  const crop = at1.plantCrop(T + 1, T + 2, 'wemp', 30);
  if (crop) crop.stage = 3;
  const h1 = FARM_ACTION_BY_ID.get('harvest_crop')!.check?.({ kind: 'tile', x: T + 1, y: T + 2 } as Parameters<NonNullable<typeof sow.check>>[0], at1) ?? 'none';
  check('a ripe wemp crop harvested at farming 1: allowed on both sides', h1 === 'none' && said('HARVEST_1') === 'none', `island ${said('HARVEST_1')} / browser ${h1}`);
}

/* ---- workers ---------------------------------------------------------------- */

const worker = (g: Game, kind: string, trade: string, skills: Record<string, number>): Creature => {
  const c = g.creatures.spawn(kind, T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  c.skills = skills;
  c.trade = trade as Creature['trade'];
  return c;
};
const run = (g: Game, c: Creature, secs: number): void => {
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    c.hunger = 1;
    c.worn = 0;
    stepper.updateWorker(c, 0.25, g);
  }
};
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  const c = worker(g, 'bevere', 'woodcut', { [GATHER_SKILL.woodcut]: 1 });
  const may = g.creatures.gatherable(g, T + 3, T, 'woodcut', c);
  run(g, c, 2);
  const says = idleSays({ why: 'gate', n: 3, what: ['tree', 'willow'] }, 'woodcut', null, 1, { woodcutting: 1 });
  const line = c.idle ? idleSays(c.idle, 'woodcut', null, c.skills[GATHER_SKILL.woodcut], c.skills) : '';
  check(`a Sapgnaw at woodcutting 1 by a mature willow: not taken, "${says}", on both sides`,
    !may && said('W1_MAY') === 'false' && said('W1') === 'gate|3|tree,willow' && c.idle?.why === 'gate' && line === says,
    `island ${said('W1_MAY')} ${said('W1')} / browser ${may} "${line}"`);
  check('and the browser is sent the gate', said('W1_SENT') === 'gate|tree,willow', said('W1_SENT'));
  check('and its card says it', creatureLines(g, c).includes(says), creatureLines(g, c).join(' / '));
  check(`at woodcutting ${NEED} it takes the willow`, said('W90_MAY') === 'true' && g.creatures.gatherable(g, T + 3, T, 'woodcut', worker(g, 'bevere', 'woodcut', { woodcutting: NEED })), said('W90_MAY'));
}
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  g.world.setTile(T, T + 5, TileType.Tree, packTreeData(PINE, MATURE));
  const c = worker(g, 'bevere', 'woodcut', { woodcutting: 1 });
  run(g, c, 2);
  check('with a pine in reach as well, it goes to the pine, on both sides',
    said('W1_PINE') === `${T},${T + 5}|` && c.workX === T && c.workY === T + 5 && !c.idle,
    `island ${said('W1_PINE')} / browser ${c.workX},${c.workY} ${c.idle?.why ?? ''}`);
}
{
  // A sprout picker at forestry 1.
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  g.world.setTile(T, T + 5, TileType.Tree, packTreeData(PINE, MATURE));
  const c = worker(g, 'sprigga', 'sprout', { forestry: 1 });
  const may = `${g.creatures.gatherable(g, T + 3, T, 'sprout', c)}|${g.creatures.gatherable(g, T, T + 5, 'sprout', c)}`;
  check('a sprout picker at forestry 1 passes a willow by and picks a pine, on both sides', may === 'false|true' && said('SP_WILLOW') === may, `island ${said('SP_WILLOW')} / browser ${may}`);
  g.world.setTile(T, T + 5, TileType.Grass, 0);
  run(g, c, 2);
  const says = idleSays({ why: 'gate', n: 3, what: ['sprout', 'willow'] }, 'sprout', null, 1, { forestry: 1 });
  check(`and with only the willow, it says why: "${says}", on both sides`,
    said('SP_IDLE') === 'gate|3|sprout,willow' && c.idle?.why === 'gate' && idleSays(c.idle, 'sprout', null, 1, c.skills) === says,
    `island ${said('SP_IDLE')} / browser ${c.idle?.why} ${c.idle?.what?.join(',')}`);
}
{
  // A hod carrier at masonry 90, at a woodcutting gate.
  const hod = { skills: { masonry: 90 } as Record<string, number> };
  const willow = gateOf('tree', 'willow');
  check('a hod carrier at masonry 90 reads a woodcutting gate at its woodcutting (1): willow shut, pine open, on both sides',
    said('HOD') === '90|false|true' && !workerGateOpen(hod, willow) && workerGateOpen(hod, gateOf('tree', 'pine')), `island ${said('HOD')}`);
  check('and at woodcutting 90, open on both sides', said('HOD_WC') === 'true' && workerGateOpen({ skills: { masonry: 90, woodcutting: 90 } }, willow), said('HOD_WC'));
}
{
  // A farmer at farming 1: onion sown, wemp passed by.
  const g = fresh();
  const c = worker(g, 'seavic', 'farm', { farming: 1 });
  const seeds = Object.keys(CROP_GATE).filter((id) => workerItemOpen(c, { id: cropSeed(id) })).map(cropSeed).sort().join(',');
  check(`a farmer at farming 1 sows only ${seeds}, on both sides`, said('FARM_SEEDS').split(',').sort().join(',') === seeds, `island ${said('FARM_SEEDS')} / browser ${seeds}`);
  g.world.setTile(T + 6, T + 6, TileType.Field);
  c.pouch = { uid: g.inventory.nextUid++, id: WEMP, ql: 20, dmg: 0, count: 2 };
  const wemp = g.creatures.farmJobAt(g, c, T + 6, T + 6);
  c.pouch = { uid: g.inventory.nextUid++, id: cropSeed('onion'), ql: 20, dmg: 0, count: 2 };
  const onion = g.creatures.farmJobAt(g, c, T + 6, T + 6);
  check(`with ${SEEDS.toLowerCase()} to hand it does not sow; with onion it sows, on both sides`,
    wemp === null && onion === 'sow' && said('FARM_WEMP') === 'none' && said('FARM_ONION') === 'onion_seed',
    `island ${said('FARM_WEMP')} ${said('FARM_ONION')} / browser ${wemp} ${onion}`);
}

/* ---- the Skills window's lists ---------------------------------------------- */

for (const skill of ['woodcutting', 'farming', 'forestry']) {
  // One line a name at a level, in level then name order (a skill's crafts are on it too since batch C).
  const table = [...new Map(SKILL_GATES.filter((g) => g.skill === skill).map((g) => [`${g.level}:${g.name}`, g])).values()]
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  for (const have of [1, 25]) {
    const list = unlocksOf(skill, have);
    const same = list.length === table.length && list.every((u, i) => u.name === table[i].name && u.level === table[i].level);
    const ticks = list.every((u) => u.met === have >= u.level);
    const sorted = list.every((u, i) => i === 0 || list[i - 1].level <= u.level);
    check(`${skill} ${have}: the Unlocks list is the gate table in level order, ticked by level (${list.filter((u) => u.met).map((u) => u.name).join(', ')})`,
      same && ticks && sorted, list.map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(' '));
  }
}
check('and the next one named with your level: "Next: Oak at 5 (yours 1.0)"', nextUnlockSaid('woodcutting', 1) === 'Next: Oak at 5 (yours 1.0)', nextUnlockSaid('woodcutting', 1) ?? '');

/* ---- decided since: the Guiding Light's sites count only the trees you fell ------------------------------ */

{
  // A 4096 island, past the stones' gap as the Path's own test has it: woods in stripes, birch and oak a row about; a
  // shore to the south, rock to the east. Sites asked at woodcutting 1 and 5, and with every stripe oak.
  const P = { x: 1400, y: 2600 };
  const OAK = species('Oak');
  const BIRCH = species('Birch');
  const sites = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; j jsonb; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fellable', 33, 4096, ${P.x}, ${P.y}, true) returning id into w;
  perform land_blank(w, 4096);
  update land_tile set tiles = overlay(tiles placing decode(repeat('10', 40), 'hex') from ${P.x - 30} for 40),
                       data = overlay(data placing decode(repeat(lpad(to_hex(case when y % 6 = 0 then ${packTreeData(BIRCH, 0)} else ${packTreeData(OAK, 0)} end), 2, '0'), 40), 'hex') from ${P.x - 30} for 40)
   where world_id = w and y between ${P.y - 30} and ${P.y + 30} and y % 3 = 0;
  update land_corner set heights = overlay(heights placing decode(repeat('f6ff', 120), 'hex') from 2 * ${P.x - 60} + 1 for 240)
   where world_id = w and y between ${P.y + 20} and ${P.y + 22};
  update land_tile set tiles = overlay(tiles placing decode(repeat('04', 10), 'hex') from ${P.x + 18} for 10)
   where world_id = w and y between ${P.y - 40} and ${P.y + 40};
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Sitefinder');
  update player set body_at = now(), x = ${P.x} + 0.5, y = ${P.y} + 0.5 where world_id = w and uid = u;
  for i in 1..3 loop
    if i = 3 then
      -- Every stripe oak.
      update land_tile set data = overlay(data placing decode(repeat(lpad(to_hex(${packTreeData(OAK, 0)}), 2, '0'), 40), 'hex') from ${P.x - 30} for 40)
       where world_id = w and y between ${P.y - 30} and ${P.y + 30} and y % 3 = 0;
    end if;
    insert into skill (world_id, uid, id, value) values (w, u, 'woodcutting', (array[1, 5, 1])[i])
      on conflict (world_id, uid, id) do update set value = excluded.value;
    j := rpc_thepath_sites(w);
    insert into said values ('N' || i, jsonb_array_length(j)::text);
    -- Each site's count against the box counted tile by tile: every tree, and the ones your woodcutting fells.
    insert into said select 'S' || i, coalesce(string_agg((s->>'trees') || ':' || (
        select count(*) filter (where tree_fells(land_data(w, x, y), (array[1, 5, 1])[i])) || ':' || count(*)
          from generate_series((s->>'x')::int - thepath_site_tree_reach()::int, (s->>'x')::int + thepath_site_tree_reach()::int) x,
               generate_series((s->>'y')::int - thepath_site_tree_reach()::int, (s->>'y')::int + thepath_site_tree_reach()::int) y
         where land_tile(w, x, y) = tile_id('Tree')), ','), '')
      from jsonb_array_elements(j) s;
  end loop;
end $t$;
select k || '=' || v from said order by k;
rollback;`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
  const rows = (i: number): Array<[number, number, number]> => (sites.get(`S${i}`) ?? '').split(',').filter(Boolean).map((r) => r.split(':').map(Number) as [number, number, number]);
  check(`woodcutting 1, birch and oak stripes: ${sites.get('N1')} sites, each counting its birch only (trees:birch:all ${sites.get('S1')})`,
    Number(sites.get('N1')) > 0 && rows(1).every(([n, fell, all]) => n === fell && fell < all), sites.get('S1') ?? '');
  check(`woodcutting 5 (oak's gate): ${sites.get('N2')} sites, each counting every tree (${sites.get('S2')})`,
    Number(sites.get('N2')) > 0 && rows(2).every(([n, fell, all]) => n === all && fell === all), sites.get('S2') ?? '');
  check(`every stripe oak at woodcutting 1: no site (${sites.get('N3')})`, sites.get('N3') === '0', sites.get('N3') ?? '');
  // The words, derived from the gates.
  const g = fresh();
  g.skills.values.set('woodcutting', 1);
  const site = PATH_STEP_BY_ID.get('site')!;
  const label1 = site.label(g);
  const why1 = site.why(g)[0] ?? '';
  g.pathSites = [{ x: 0, y: 0, trees: 14, water: 6, rock: 11 } as PathSite];
  const said1 = site.label(g);
  g.skills.values.set('woodcutting', 5);
  const said5 = site.label(g);
  check(`the Path's site step names the trees counted, from the gates: "${label1}", "${why1}", "${said1}"; at 5 "${said5}"`,
    label1.startsWith('Site: birch or pine ≥10 in 10') && why1.startsWith('Birch or pine ≥10 within 10') && said1.startsWith('Site: Birch or pine 14 · Water 6')
      && fellsSaid(g) === 'birch, pine or oak' && said5.startsWith('Site: Birch, pine or oak 14'), `${label1} | ${why1} | ${said1} | ${said5}`);
}

finish('Skill gates: trees, sprouts and crops, for you and for workers at their own level; items unidentified under their gate');
