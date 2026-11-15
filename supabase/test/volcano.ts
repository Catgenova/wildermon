/**
 * Volcano Isle, part one: its three monsters at their vents, obsidian off a monster killed there and nowhere else, a
 * seryll vein's summons, sulfur, and fire-tempered steel.
 *
 * Asked for: "new harder volcano monsters, not wildermon", each at a lair of its own on the volcano with a boss and a
 * hoard; "obsidian drops only from monsters killed on Volcano Isle"; "mining seryll has a chance to summon monsters",
 * never in a settlement or a runestone's safe ring, gone after their time; sulfur, and fire-tempered steel made only at
 * a smelter on the volcano with a raised QL cap. Asked of the island, on an island of its own made for the purpose, and
 * of the browser's words and numbers for the same rules:
 *
 *   * every number is the same on both sides, and each kind is harder than an ogre and none as hard as the dragon;
 *   * the vents site only on Volcano Isle, on their ground, and the kinds stand up only there, never off the wild's roll;
 *   * a monster's carcass carries the island it died on, and butchering one killed on the volcano gives its kind's
 *     obsidian, one killed elsewhere none; and the vents' kinds give sulfur;
 *   * a seryll go on the volcano summons at its chance and not at it, a slate go gives sulfur at its chance, and none of
 *     it off the island; the summons stand round the miner, leashed to the spot, at their kind's health and blow,
 *     and none stand up in a settlement, the safe ring (spawn and runestones) or a Sanctuary;
 *   * the summons go once their time is up on the lairs' clock, and not a second before;
 *   * fire-tempered steel is refused off the volcano in the browser's words, and made at a smelter on it; and its
 *     weapons and tools are bettered past the skill by its cap, steel's not;
 *   * an ash wraith's blow blinds, a magma golem takes no burns, and an ice enchantment bites it harder.
 *
 * Every rolled rule is asked with the dice held (`dice.random`), at either side of its line. Runs against the database
 * the suite leaves behind, in one transaction that is rolled back.
 */
import { MONSTER_KINDS, SPECIES } from '../../src/game/creatures';
import { LAIR_KINDS, LAIR_LEASH, VENT_CLEAR } from '../../src/game/lairs';
import { carcassObsidian } from '../../src/game/butcher';
import { fireSteelCapOf } from '../../src/game/improve';
import { isleSays, RECIPE_BY_ID } from '../../src/game/recipes';
import { itemDef } from '../../src/game/items';
import { guidePage } from '../../src/game/guide';
import {
  ASH_BLIND_HIT, ASH_BLIND_SECS, DIED_ON, FIRE_STEEL_CAP, FIRE_STEEL_NAME, FIRE_STEEL_RECIPE, FROST_WEAK, OBSIDIAN_BY_KIND, obsidianOf,
  SERYLL_SUMMON, SULFUR_SLATE, SUMMON_LEAST, SUMMON_MOST, SUMMON_NEAR, SUMMON_SECS, SUMMON_SPREAD, VOLCANO_ISLE, VOLCANO_KINDS,
} from '../../src/game/volcano';
import { percent } from '../../src/game/words';
import { check, finish, psql } from './harness';

const U = { p: '701c0000-0000-4000-8000-0000000000a1' };
/** Big enough that six vents, fifty tiles apart with their leashes on the island, always find room on Volcano Isle. */
const SIZE = 768;
/** Volcano Isle on it, and somewhere that is not. */
const ON = { x: 345, y: 105 };
const OFF = { x: 450, y: 495 };
const VENTS = LAIR_KINDS.filter((k) => k.site === 'vent');

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wildermon.dice')::double precision;
end $f$;
do $t$
declare w uuid; w2 uuid; l lair; k record; c creature; v_id int; v_n int; i int; v_max bigint; v_corpse item; v_sword bigint; v_steel bigint;
        v_ench bigint; v_ids int[]; v_sp text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Volcano', 4343, ${SIZE}, 20, ${SIZE - 12}, true) returning id into w;
  perform land_blank(w, ${SIZE});
  update land_corner set heights = decode(repeat('6400', ${SIZE + 1}), 'hex') where world_id = w;
  -- Trees down every eighth column of the west, grass everywhere else.
  update land_tile t set tiles = (select decode(string_agg(lpad(to_hex(case when gx < 300 and gx % 8 = 0 then 16 else 0 end), 2, '0'), '' order by gx), 'hex')
    from generate_series(0, ${SIZE - 1}) gx) where t.world_id = w;

  -- ---- Both sides' numbers ------------------------------------------------------------------------------------------
  insert into said values ('NUMS', volcano_isle() || '|' || array_to_string(volcano_kinds(), ',') || '|' || (select string_agg(id || ':' || obsidian_of(id), ',' order by id) from species_def where monster) || '|' || seryll_summon() || '|'
    || summon_least() || '|' || summon_most() || '|' || summon_near() || '|' || summon_spread() || '|' || summon_secs() || '|' || sulfur_slate() || '|'
    || fire_steel_cap() || '|' || ash_blind_hit() || '|' || ash_blind_secs() || '|' || frost_weak() || '|' || vent_clear() || '|' || died_on_key() || '|' || fire_steel_name());
  insert into said select 'KIND', id || '|' || health || '|' || attack || '|' || monster || '|' || blinds || '|' || fireproof || '|' || frost_weak || '|'
    || coalesce(monster_isle(id), -1) || '|' || coalesce((select string_agg(sb.part || ':' || sb.n, ',' order by sb.part) from species_butcher sb where sb.species = s.id), '-')
    from species_def s where s.monster;
  insert into said select 'ISLES', region_at(w, ${ON.x + 0.5}, ${ON.y + 0.5}) || '|' || region_at(w, ${OFF.x + 0.5}, ${OFF.y + 0.5});

  -- ---- The vents --------------------------------------------------------------------------------------------------
  for k in select * from lair_kinds() where site = 'vent' order by id loop
    for i in 1 .. k.count loop
      if lair_stand(w, k.id, 4000) is null then insert into said values ('NOSITE', k.id); end if;
    end loop;
  end loop;
  for l in select * from lair where world_id = w order by id loop
    insert into said values ('VENT', l.kind || '|' || coalesce(region_at(w, l.x + 0.5, l.y + 0.5), -1) || '|' || near_tile(w, l.x, l.y, 'trees', vent_clear()::int) || '|' || l.state || '|'
      || coalesce((select string_agg(c2.species || ':' || c2.boss || ':' || coalesce(region_at(w, creature_x(c2), creature_y(c2)), -1), ',' order by c2.id) from creature c2 where c2.world_id = w and c2.lair = l.id), '-'));
  end loop;
  -- Off the island: every vent kind refused on every tile of a stretch an orc camp would take.
  insert into said select 'OFFSITE', count(*) filter (where lair_site_ok(w, v.id, a, b)) || '|' || count(*) filter (where lair_site_ok(w, 'orc_camp', a, b))
    from (select id from lair_kinds() where site = 'vent') v, generate_series(${OFF.x - 30}, ${OFF.x + 30}, 6) a, generate_series(${OFF.y - 30}, ${OFF.y + 30}, 6) b
   where region_at(w, a + 0.5, b + 0.5) is distinct from volcano_isle();
  -- Nor off the wild's roll, anywhere on the island.
  insert into said select 'WILDPICK', coalesce(string_agg(distinct got, ','), '-') from (
    select pick_wild(w, (a * 37) % ${SIZE}, (a * 91) % ${SIZE}) as got from generate_series(1, 600) a) x where got = any (volcano_kinds());
  -- A boss of each, at its kind's health and blow times its lair's.
  for k in select * from lair_kinds() where site = 'vent' order by id loop
    select * into l from lair where world_id = w and kind = k.id order by id limit 1;
    delete from creature where world_id = w and lair = l.id;
    perform lair_turn(w, l.id);
    update creature set traits = '{}', rare = null where world_id = w and lair = l.id and boss;
    insert into said select 'BOSS', k.id || '|' || c2.name || '|' || max_health(c2) || '|' || attack_of(c2) from creature c2 where c2.world_id = w and c2.lair = l.id and c2.boss;
  end loop;

  -- ---- A body -------------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.p}')::text, true);
  perform rpc_join(w, 'Miner');
  update player set body_at = now(), x = ${ON.x + 0.5}, y = ${ON.y + 0.5}, away = false where world_id = w and uid = '${U.p}';
  insert into skill (world_id, uid, id, value) values (w, '${U.p}', 'butchering', 100), (w, '${U.p}', 'smelting', 100), (w, '${U.p}', 'weaponsmithing', 30)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, '${U.p}', 'butchering_knife', 1, 100);

  -- ---- Each vent's boss killed: its hoard, its clearing, its restock --------------------------------------------------
  for k in select * from lair_kinds() where site = 'vent' order by id loop
    select * into l from lair where world_id = w and kind = k.id order by id limit 1;
    select coalesce(max(id), 0) into v_max from item;
    perform wound_beast(w, (select c2.id from creature c2 where c2.world_id = w and c2.lair = l.id and c2.boss), 1e9, null, null, '${U.p}', null);
    insert into said select 'HOARD', k.id || '|' || (select state from lair where world_id = w and id = l.id) || '|'
      || coalesce((select string_agg(i2.def || ':' || i2.count, ',' order by i2.def) from item i2 where i2.id > v_max and i2.holder = 'player'
                     and i2.holder_uid = '${U.p}' and i2.def not in ('treasure_map', 'recipe_book', 'formula_book')), '-');
    update lair set cleared_at = now() - make_interval(secs => k.restock - 1) where world_id = w and id = l.id;
    perform lair_turn(w, l.id);
    insert into said select 'RESTOCK', k.id || '|early|' || state || '|' || lair_garrison_up(w, l.id) from lair where world_id = w and id = l.id;
    update lair set cleared_at = now() - make_interval(secs => k.restock + 1) where world_id = w and id = l.id;
    perform lair_turn(w, l.id);
    insert into said select 'RESTOCK', k.id || '|due|' || state || '|' || lair_garrison_up(w, l.id) from lair where world_id = w and id = l.id;
  end loop;

  -- ---- Obsidian -----------------------------------------------------------------------------------------------------
  for k in select * from (values ('goblin', ${ON.x}, ${ON.y}), ('goblin', ${OFF.x}, ${OFF.y}), ('dragon', ${ON.x}, ${ON.y}), ('magma_golem', ${ON.x}, ${ON.y}), ('ash_wraith', ${OFF.x}, ${OFF.y}), ('rabba', ${ON.x}, ${ON.y})) v (sp, x, y) loop
    v_id := creature_spawn(w, k.sp, k.x + 0.5, k.y + 0.5, 'wild');
    perform wound_beast(w, v_id, 1e9, null, null, '${U.p}', null);
    select * into v_corpse from item where world_id = w and def = 'corpse' and holder = 'ground' order by id desc limit 1;
    -- An empty pack, so nothing butchered goes to the ground for its weight.
    delete from item where holder = 'player' and holder_uid = '${U.p}' and def <> 'butchering_knife';
    select coalesce(max(id), 0) into v_max from item;
    perform perform_fight(w, '${U.p}', 'butcher', jsonb_build_object('kind', 'ground', 'x', v_corpse.gx, 'y', v_corpse.gy, 'uid', v_corpse.id));
    insert into said select 'CARCASS', k.sp || '|' || k.x || '|' || coalesce(v_corpse.mark::text, '-') || '|' || carcass_obsidian(v_corpse) || '|'
      || coalesce((select sum(count) from item i2 where i2.id > v_max and i2.holder = 'player' and i2.holder_uid = '${U.p}' and i2.def = 'obsidian'), 0) || '|'
      || coalesce((select sum(count) from item i2 where i2.id > v_max and i2.holder = 'player' and i2.holder_uid = '${U.p}' and i2.def = 'sulfur'), 0);
  end loop;

  -- ---- A seryll vein, and slate -----------------------------------------------------------------------------------------
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  for k in select * from (values ('seryll_ore', ${ON.x}, ${ON.y}, (${SERYLL_SUMMON} - 1e-9)::double precision, 'under'), ('seryll_ore', ${ON.x}, ${ON.y}, ${SERYLL_SUMMON}::double precision, 'at'),
                                 ('seryll_ore', ${OFF.x}, ${OFF.y}, 0::double precision, 'off'), ('slate_shards', ${ON.x}, ${ON.y}, (${SULFUR_SLATE} - 1e-9)::double precision, 'under'),
                                 ('slate_shards', ${ON.x}, ${ON.y}, ${SULFUR_SLATE}::double precision, 'at'), ('slate_shards', ${OFF.x}, ${OFF.y}, 0::double precision, 'off'),
                                 ('seryll_ore', ${ON.x}, ${ON.y}, 0.999::double precision, 'top')) v (yields, x, y, d, tag) loop
    perform set_config('wildermon.dice', k.d::text, true);
    delete from creature where world_id = w and gone_at is not null;
    delete from item where holder = 'player' and holder_uid = '${U.p}' and def = 'sulfur';
    v_n := volcano_mined(w, '${U.p}', k.x, k.y, k.yields, 40);
    insert into said select 'MINED', k.yields || '|' || k.x || '|' || k.tag || '|' || v_n || '|'
      || coalesce((select string_agg(c2.species, ',' order by c2.id) from creature c2 where c2.world_id = w and c2.gone_at is not null), '-') || '|'
      || coalesce((select sum(count) from item i2 where i2.holder = 'player' and i2.holder_uid = '${U.p}' and i2.def = 'sulfur'), 0);
  end loop;
  perform set_config('search_path', 'public, pg_catalog', true);
  -- Three of each kind round the miner, as a go summons them.
  delete from creature where world_id = w and gone_at is not null;
  foreach v_sp in array volcano_kinds() loop
    perform seryll_summon_at(w, '${U.p}', v_sp, 3);
  end loop;
  insert into said select 'FULL', count(*) || '|' || count(*) filter (where c2.health = max_health(c2)) from creature c2 where c2.world_id = w and c2.gone_at is not null;
  update creature set traits = '{}', rare = null where world_id = w and gone_at is not null;
  insert into said select 'SUMMON', c2.species || '|' || round(sqrt((c2.to_x - ${ON.x + 0.5}) ^ 2 + (c2.to_y - ${ON.y + 0.5}) ^ 2)::numeric, 3) || '|'
    || (c2.leash_x = ${ON.x + 0.5} and c2.leash_y = ${ON.y + 0.5}) || '|' || round(extract(epoch from c2.gone_at - now())::numeric) || '|'
    || true || '|' || max_health(c2) || '|' || attack_of(c2) || '|' || coalesce(c2.hunting::text, '-') || '|' || (c2.lair is null)
    from creature c2 where c2.world_id = w and c2.gone_at is not null order by c2.id;
  insert into said select 'TOLD', coalesce(string_agg(text, '~' order by n), '-') from event where world_id = w and uid = '${U.p}' and text like 'Summoned%';
  -- Held to its leash, however it is moved.
  select * into c from creature where world_id = w and gone_at is not null order by id limit 1;
  update creature set to_x = to_x + 100, from_x = from_x + 60 where world_id = w and id = c.id;
  insert into said select 'HELD', round(sqrt((to_x - leash_x) ^ 2 + (to_y - leash_y) ^ 2)::numeric, 3) from creature where world_id = w and id = c.id;

  -- Nowhere refused: the safe ring at the spawn, a settlement, a Sanctuary, and a runestone's ring on an island big enough for one.
  update player set x = 20.5, y = ${SIZE - 11.5} where world_id = w and uid = '${U.p}';
  insert into said values ('REFUSED', 'spawn|' || summon_refused(w, 20.5, ${SIZE - 11.5}) || '|' || seryll_summon_at(w, '${U.p}', 'ash_wraith', 3));
  update player set x = ${ON.x + 0.5}, y = ${ON.y + 0.5} where world_id = w and uid = '${U.p}';
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ash', ${ON.x}, ${ON.y}, 5, 1, '${U.p}');
  insert into said values ('REFUSED', 'deed|' || summon_refused(w, ${ON.x + 0.5}, ${ON.y + 0.5}) || '|' || seryll_summon_at(w, '${U.p}', 'ash_wraith', 3));
  delete from deed where world_id = w and name = 'Ash';
  insert into faith_zone (world_id, kind, x, y, r, until) values (w, 'sanctuary', ${ON.x + 0.5}, ${ON.y + 0.5}, 8, now() + interval '1 hour');
  insert into said values ('REFUSED', 'sanctuary|' || summon_refused(w, ${ON.x + 0.5}, ${ON.y + 0.5}) || '|' || seryll_summon_at(w, '${U.p}', 'ash_wraith', 3));
  delete from faith_zone where world_id = w;
  insert into said values ('REFUSED', 'open|' || summon_refused(w, ${ON.x + 0.5}, ${ON.y + 0.5}) || '|-');
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Runestones', 4344, 1024, 20, 1000, false) returning id into w2;
  insert into said values ('RUNESTONE', summon_refused(w2, floor(2152.5 * 1024 / 4096) + 0.5, floor(2948.5 * 1024 / 4096) + 0.5) || '|'
    || summon_refused(w2, floor(2152.5 * 1024 / 4096) + 0.5, floor(2948.5 * 1024 / 4096) + 0.5 - 70));

  -- ---- Their time ---------------------------------------------------------------------------------------------------
  v_ids := array(select id from creature where world_id = w and gone_at is not null order by id limit 2);
  update creature set gone_at = now() - interval '1 second' where world_id = w and id = v_ids[1];
  update creature set gone_at = now() + interval '1 second' where world_id = w and id = v_ids[2];
  update creature set enemy = v_ids[1] where world_id = w and id = v_ids[2];
  perform lair_tick(w);
  insert into said values ('GONE', exists (select 1 from creature where world_id = w and id = v_ids[1]) || '|' || exists (select 1 from creature where world_id = w and id = v_ids[2])
    || '|' || coalesce((select enemy::text from creature where world_id = w and id = v_ids[2]), '-'));

  -- ---- Fire-tempered steel ------------------------------------------------------------------------------------------
  perform give(w, '${U.p}', 'steel_lump', 4, 60);
  perform give(w, '${U.p}', 'sulfur', 2, 60);
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since)
    values (w, 'smelter', ${ON.x + 1}, ${ON.y}, 0, 0, ${ON.x + 1.5}, ${ON.y + 0.5}, 50, 1e6, true, now());
  insert into said values ('SMELT', 'on|' || coalesce(craft_refusal(w, '${U.p}', '${FIRE_STEEL_RECIPE}', null), '-'));
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0', true);
  perform perform_craft(w, '${U.p}', '${FIRE_STEEL_RECIPE}', '{}'::jsonb);
  perform set_config('search_path', 'public, pg_catalog', true);
  insert into said select 'MADE', coalesce(sum(count), 0)::text from item where holder = 'player' and holder_uid = '${U.p}' and def = 'firesteel_lump';
  update placed set x = ${OFF.x + 1}, y = ${OFF.y}, cx = ${OFF.x + 1.5}, cy = ${OFF.y + 0.5} where world_id = w and kind = 'smelter';
  update player set x = ${OFF.x + 0.5}, y = ${OFF.y + 0.5} where world_id = w and uid = '${U.p}';
  insert into said values ('SMELT', 'off|' || coalesce(craft_refusal(w, '${U.p}', '${FIRE_STEEL_RECIPE}', null), '-'));
  insert into said values ('SMELT', 'steel off|' || coalesce(craft_refusal(w, '${U.p}', 'make_steel', null), '-'));

  -- ---- Its cap ------------------------------------------------------------------------------------------------------
  insert into said select 'CAP', d || ':' || coalesce(e, '-') || ':' || fire_steel_cap(d, e)
    from (values ('long_sword', '${FIRE_STEEL_NAME}'), ('long_sword', 'Steel'), ('pickaxe', '${FIRE_STEEL_NAME}'), ('firesteel_lump', '${FIRE_STEEL_NAME}'), ('long_sword', null)) v (d, e);
  perform give(w, '${U.p}', 'file', 1, 80);
  perform give(w, '${U.p}', 'whetstone', 1, 80);
  perform give(w, '${U.p}', 'firesteel_lump', 2, 60);
  v_sword := give(w, '${U.p}', 'long_sword', 1, 33, '${FIRE_STEEL_NAME}');
  v_steel := give(w, '${U.p}', 'long_sword', 1, 33, 'Steel');
  insert into said values ('IMPROVE', coalesce(item_refusal(w, '${U.p}', 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_sword)), '-') || '|'
    || coalesce(item_refusal(w, '${U.p}', 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_steel)), '-'));
  update item set ql = 35 where id = v_sword;
  insert into said values ('IMPROVE', coalesce(item_refusal(w, '${U.p}', 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_sword)), '-') || '|-');

  -- ---- What they do -------------------------------------------------------------------------------------------------
  select * into c from creature where world_id = w and species = 'ash_wraith' order by id limit 1;
  insert into said values ('BLIND', ash_blind_of(w, '${U.p}') || '|' || round(hit_chance(w, '${U.p}', 'swords', 1)::numeric, 6));
  -- Put in a statement of its own, so what follows reads what it wrote.
  v_n := ash_blind_put(w, '${U.p}', c)::int;
  insert into said values ('BLIND', (v_n = 1) || '|' || ash_blind_of(w, '${U.p}') || '|' || round(hit_chance(w, '${U.p}', 'swords', 1)::numeric, 6)
    || '|' || round(extract(epoch from (select (blessings->'ash_blind'->>'until')::timestamptz from player where world_id = w and uid = '${U.p}') - now())::numeric));
  select * into c from creature where world_id = w and species = 'magma_golem' order by id limit 1;
  insert into said values ('BLIND', ash_blind_put(w, '${U.p}', c)::text || '|-|-|-');
  update player set blessings = jsonb_set(blessings, '{ash_blind,until}', to_jsonb(now() - interval '1 second')) where world_id = w and uid = '${U.p}';
  insert into said values ('BLIND', ash_blind_of(w, '${U.p}') || '|' || round(hit_chance(w, '${U.p}', 'swords', 1)::numeric, 6));
  insert into said values ('BURN', coalesce(class_burn(w, '${U.p}', c.id, 0.01, 5)::text, '-') || '|'
    || coalesce(class_burn(w, '${U.p}', (select id from creature where world_id = w and species = 'cinder_hound' order by id limit 1), 0.01, 5)::text, '-'));
  v_ench := give(w, '${U.p}', 'long_sword', 1, 50, 'Steel');
  update item set enchant = '{"id": "razoredge", "ql": 50}'::jsonb where id = v_ench;
  insert into said select 'FROST', frost_bane(ia, sg) || '|' || frost_bane(ia, sh) || '|' || frost_bane(ib, sg) || '|' || frost_bane(ic, sg)
    from item ia, item ib, item ic, species_def sg, species_def sh
   where ia.id = v_ench and ib.id = v_steel and ic.id = v_ench and sg.id = 'magma_golem' and sh.id = 'cinder_hound';
  update item set enchant = '{"id": "emberbrand", "ql": 50}'::jsonb where id = v_ench;
  insert into said select 'FROST', frost_bane(ia, sg)::text || '|-|-|-' from item ia, species_def sg where ia.id = v_ench and sg.id = 'magma_golem';
  insert into said values ('PATCHED', (pg_get_functiondef('perform_terrain(uuid, uuid, text, jsonb)'::regprocedure) like '%perform volcano_mined(p_world, p_uid, tx, ty, yields, made_ql);%')
    || '|' || (pg_get_functiondef('lair_tick(uuid)'::regprocedure) like '%perform summon_sweep(p_world);%'));
end $t$;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => said(k)[0] ?? '';

/* ---- both sides' numbers ------------------------------------------------------------------------------------------- */

check('the island\'s numbers are the browser\'s: the island, its kinds, obsidian, the summons, sulfur, the cap, the blinding, the frost, a vent\'s clearing',
  one('NUMS') === [VOLCANO_ISLE, VOLCANO_KINDS.join(','), MONSTER_KINDS.slice().sort().map((id) => `${id}:${obsidianOf(id)}`).join(','), SERYLL_SUMMON, SUMMON_LEAST, SUMMON_MOST, SUMMON_NEAR, SUMMON_SPREAD, SUMMON_SECS,
    SULFUR_SLATE, FIRE_STEEL_CAP, ASH_BLIND_HIT, ASH_BLIND_SECS, FROST_WEAK, VENT_CLEAR, DIED_ON, FIRE_STEEL_NAME].join('|'), one('NUMS'));
check('the numbers asked for: 4% a go, 1 to 3, 10 minutes, steel\'s cap +5', SERYLL_SUMMON === 0.04 && SUMMON_LEAST === 1 && SUMMON_MOST === 3
  && SUMMON_SECS === 600 && FIRE_STEEL_CAP === 5);
const kinds = new Map(said('KIND').map((r) => [r.split('|')[0], r.split('|')]));
for (const id of VOLCANO_KINDS) {
  const d = SPECIES[id];
  const r = kinds.get(id);
  const parts = Object.entries(d.butcher).filter(([, n]) => n).map(([p, n]) => `${p}:${n}`).sort().join(',');
  check(`${d.name}: a monster, on both sides at health ${d.health} and blow ${d.attack}, kept to Volcano Isle, its parts ${parts}`,
    !!r && r[1] === String(d.health) && Math.abs(Number(r[2]) - d.attack) < 1e-4 && r[3] === 'true' && r[4] === String(!!d.blinds) && r[5] === String(!!d.fireproof)
      && r[6] === String(!!d.frostWeak) && r[7] === String(VOLCANO_ISLE) && r[8] === parts && !!d.monster && d.tameChance === 0, r?.join('|'));
  check(`${d.name}: harder than an ogre (${SPECIES.ogre.health}/${SPECIES.ogre.attack}), not as hard as the dragon (${SPECIES.dragon.health}/${SPECIES.dragon.attack})`,
    d.health > SPECIES.ogre.health && d.attack > SPECIES.ogre.attack && d.health < SPECIES.dragon.health && d.attack < SPECIES.dragon.attack, `${d.health}/${d.attack}`);
}
check('one of each: the ash wraith blinds, the magma golem takes no burns and ice bites it, the cinder hound runs in a pack and outruns the rest',
  !!SPECIES.ash_wraith.blinds && !!SPECIES.magma_golem.fireproof && !!SPECIES.magma_golem.frostWeak && !!SPECIES.cinder_hound.pack
  && SPECIES.cinder_hound.speed > SPECIES.ash_wraith.speed && SPECIES.magma_golem.speed < SPECIES.ogre.speed && !!SPECIES.magma_golem.heavy);
const [onIsle, offIsle] = one('ISLES').split('|').map(Number);
check('the test\'s two spots: one on Volcano Isle, one not', onIsle === VOLCANO_ISLE && offIsle !== VOLCANO_ISLE, one('ISLES'));

/* ---- the vents ----------------------------------------------------------------------------------------------------- */

check(`${VENTS.length} vent kinds, ${VENTS.reduce((n, k) => n + k.count, 0)} vents, each a kind of the volcano's own, with a boss and a trophy`,
  VENTS.length === 3 && VENTS.every((k) => VOLCANO_KINDS.includes(k.species) && k.count >= 2 && !!k.boss && !!k.trophy && k.garrison.length > 0)
  && VOLCANO_KINDS.every((id) => VENTS.some((k) => k.species === id)));
check('every vent sited', !said('NOSITE').length, said('NOSITE').join(','));
check('the cinder vent\'s garrison a pack of three', VENTS.find((k) => k.species === 'cinder_hound')?.garrison.join() === 'cinder_hound,3,3');
for (const v of said('VENT')) {
  const [kind, region, trees, state, who] = v.split('|');
  const k = VENTS.find((x) => x.id === kind)!;
  const members = who === '-' ? [] : who.split(',');
  check(`${k.name}: on Volcano Isle, no tree within ${VENT_CLEAR} tiles, held by its garrison, every one of it on Volcano Isle`,
    Number(region) === VOLCANO_ISLE && trees === 'false' && state === 'held' && members.length > 0
      && members.every((m) => m.startsWith(`${k.species}:false:`) && m.endsWith(`:${VOLCANO_ISLE}`)), v);
}
const [offOk, campOk] = one('OFFSITE').split('|').map(Number);
check('off Volcano Isle no vent is sited, on ground an orc camp takes', offOk === 0 && campOk > 0, one('OFFSITE'));
check('the wild\'s roll puts down none of them', one('WILDPICK') === '-', one('WILDPICK'));
for (const b of said('BOSS')) {
  const [id, name, hp, blow] = b.split('|');
  const k = VENTS.find((x) => x.id === id)!;
  const d = SPECIES[k.species];
  check(`${k.name}'s boss: ${k.boss}, health ${d.health} × ${k.bossHealth}, blow ${d.attack} × ${k.bossAttack}; under the dragon's`,
    name === k.boss && Number(hp) === Math.round(d.health * k.bossHealth) && Math.abs(Number(blow) - d.attack * k.bossAttack) < 1e-3
      && Number(hp) < SPECIES.dragon.health && Number(blow) < SPECIES.dragon.attack, b);
}

for (const k of VENTS) {
  const h = said('HOARD').find((r) => r.startsWith(`${k.id}|`))?.split('|');
  check(`${k.name}: its boss killed, cleared, a hoard share with its trophy (${itemDef(k.trophy).name.toLowerCase()})`,
    !!h && h[1] === 'cleared' && h[2].split(',').includes(`${k.trophy}:1`), h?.join('|'));
  const early = said('RESTOCK').find((r) => r.startsWith(`${k.id}|early|`));
  const due = said('RESTOCK').find((r) => r.startsWith(`${k.id}|due|`));
  check(`${k.name}: still cleared a second before its ${k.restock / 60} minutes, the first of its garrison back a second after`,
    early === `${k.id}|early|cleared|0` && due === `${k.id}|due|held|1`, `${early} ${due}`);
}

/* ---- obsidian ------------------------------------------------------------------------------------------------------ */

const carcass = new Map<string, string[]>();
for (const r of said('CARCASS')) {
  const f = r.split('|');
  carcass.set(`${f[0]}@${f[1]}`, f);
}
const on = (sp: string) => carcass.get(`${sp}@${ON.x}`);
const off = (sp: string) => carcass.get(`${sp}@${OFF.x}`);
for (const sp of ['goblin', 'dragon', 'magma_golem']) {
  const f = on(sp);
  const n = obsidianOf(sp);
  check(`a ${sp} killed on Volcano Isle: its carcass says so, ${n} obsidian in it, all of it butchered at a full share`,
    !!f && f[2] === `{"${DIED_ON}": ${VOLCANO_ISLE}}` && f[3] === String(n) && f[4] === String(n), f?.join('|'));
  check(`and the browser's carcass reads the same ${n}`, carcassObsidian({ uid: 1, id: 'corpse', ql: 50, dmg: 0, count: 1, extra: SPECIES[sp].name, mark: JSON.parse(f?.[2] ?? '{}') }) === n);
}
for (const sp of ['goblin', 'ash_wraith']) {
  const f = off(sp);
  check(`a ${sp} killed off Volcano Isle: its carcass says where, and no obsidian`, !!f && f[2] === `{"${DIED_ON}": ${offIsle}}` && f[3] === '0' && f[4] === '0', f?.join('|'));
}
check('the browser: none off a carcass with no mark, or one from another island', carcassObsidian({ uid: 1, id: 'corpse', ql: 50, dmg: 0, count: 1, extra: 'Goblin' }) === 0
  && carcassObsidian({ uid: 1, id: 'corpse', ql: 50, dmg: 0, count: 1, extra: 'Goblin', mark: { [DIED_ON]: offIsle } as never }) === 0);
check('a wildermon killed there: no mark, no obsidian', on('rabba')?.[2] === '-' && on('rabba')?.[3] === '0', on('rabba')?.join('|'));
check('obsidian for every monster kind, more for the harder: the more health and blow, the more obsidian', MONSTER_KINDS.every((a) => obsidianOf(a) > 0
  && MONSTER_KINDS.every((b) => !(SPECIES[a].health * SPECIES[a].attack > SPECIES[b].health * SPECIES[b].attack) || obsidianOf(a) > obsidianOf(b)))
  && Object.keys(OBSIDIAN_BY_KIND).every((id) => SPECIES[id]?.monster), MONSTER_KINDS.map((id) => `${id} ${obsidianOf(id)}`).join(', '));
check(`sulfur off a magma golem: ${SPECIES.magma_golem.butcher.sulfur}; and off an ash wraith killed anywhere: ${SPECIES.ash_wraith.butcher.sulfur}; none off a goblin`,
  on('magma_golem')?.[5] === String(SPECIES.magma_golem.butcher.sulfur) && off('ash_wraith')?.[5] === String(SPECIES.ash_wraith.butcher.sulfur) && on('goblin')?.[5] === '0',
  `${on('magma_golem')?.join('|')} ${off('ash_wraith')?.join('|')}`);
check('the item: obsidian, as both branches have it', itemDef('obsidian').name === 'Obsidian' && itemDef('obsidian').weight === 0.5);

/* ---- a seryll vein ------------------------------------------------------------------------------------------------- */

const mined = said('MINED').map((r) => r.split('|'));
const at = (y: string, tag: string) => mined.find((m) => m[0] === y && m[2] === tag);
const under = at('seryll_ore', 'under');
check(`a seryll go on Volcano Isle under ${percent(SERYLL_SUMMON)}: summons (the first kind, ${SUMMON_LEAST} of it, at the lowest roll)`,
  !!under && under[3] === String(SUMMON_LEAST) && under[4] === VOLCANO_KINDS[0], under?.join('|'));
check(`and at ${percent(SERYLL_SUMMON)}: none`, at('seryll_ore', 'at')?.[3] === '0' && at('seryll_ore', 'at')?.[4] === '-');
check('a seryll go off Volcano Isle: none, whatever the roll', at('seryll_ore', 'off')?.[3] === '0' && at('seryll_ore', 'off')?.[4] === '-');
check(`a slate go on Volcano Isle under ${percent(SULFUR_SLATE)}: a sulfur; at it, none; off the island, none`,
  at('slate_shards', 'under')?.[5] === '1' && at('slate_shards', 'at')?.[5] === '0' && at('slate_shards', 'off')?.[5] === '0'
    && at('slate_shards', 'under')?.[3] === '0', said('MINED').join(' '));
check('the chance is named where the ore is examined', (itemDef('seryll_ore').description ?? '').includes(`${percent(SERYLL_SUMMON)} a go`), itemDef('seryll_ore').description);
const summoned = said('SUMMON').map((r) => r.split('|'));
check(`three of each kind summoned stand up ${SUMMON_NEAR}–${SUMMON_NEAR + SUMMON_SPREAD} tiles from the miner, leashed to the spot, gone in ${SUMMON_SECS} s, after the miner, of no lair`,
  summoned.length === 9 && summoned.every((s) => Number(s[1]) >= SUMMON_NEAR - 1e-6 && Number(s[1]) <= SUMMON_NEAR + SUMMON_SPREAD + 1e-6 && s[2] === 'true'
    && Math.abs(Number(s[3]) - SUMMON_SECS) <= 1 && s[7] === U.p && s[8] === 'true'), said('SUMMON').join(' '));
check('each at its full health', one('FULL') === '9|9', one('FULL'));
check('each at its kind\'s health and blow, its blood put aside', summoned.every((s) => s[4] === 'true' && Number(s[5]) === SPECIES[s[0]].health && Math.abs(Number(s[6]) - SPECIES[s[0]].attack) < 1e-3),
  said('SUMMON').join(' '));
check('the miner is told', one('TOLD').includes(`Summoned (seryll vein): 3 × ash wraith; gone in ${SUMMON_SECS / 60} minutes.`), one('TOLD'));
check(`and one moved a hundred tiles off is held at its ${LAIR_LEASH}-tile leash`, Math.abs(Number(one('HELD')) - LAIR_LEASH) < 1e-3, one('HELD'));
const refused = new Map(said('REFUSED').map((r) => [r.split('|')[0], r.split('|')]));
for (const where of ['spawn', 'deed', 'sanctuary']) {
  check(`none summoned in the ${where === 'spawn' ? 'safe ring at the spawn' : where === 'deed' ? 'settlement' : 'Sanctuary'}`,
    refused.get(where)?.[1] === 'true' && refused.get(where)?.[2] === '0', refused.get(where)?.join('|'));
}
check('and open ground is not refused', refused.get('open')?.[1] === 'false');
check('nor in a runestone\'s safe ring; outside it, not refused', one('RUNESTONE') === 'true|false', one('RUNESTONE'));

/* ---- their time ---------------------------------------------------------------------------------------------------- */

check('the lairs\' clock: one past its time gone and let go of, one a second short of it still there', one('GONE') === 'false|true|-', one('GONE'));

/* ---- fire-tempered steel ------------------------------------------------------------------------------------------- */

const smelt = new Map(said('SMELT').map((r) => [r.split('|')[0], r.split('|')[1]]));
const recipe = RECIPE_BY_ID.get(FIRE_STEEL_RECIPE)!;
check('at a hot smelter on Volcano Isle: not refused', smelt.get('on') === '-', smelt.get('on'));
check(`and made: ${recipe.count} lumps of ${FIRE_STEEL_NAME.toLowerCase()} off ${recipe.inputs.map((i) => `${i.count} ${i.item}`).join(', ')}`,
  one('MADE') === String(recipe.count), one('MADE'));
check('off Volcano Isle: refused in the browser\'s words', smelt.get('off') === isleSays(recipe) && isleSays(recipe) === 'Need: hot smelter on Volcano Isle.', smelt.get('off'));
check('plain steel made anywhere', smelt.get('steel off') !== isleSays(recipe), smelt.get('steel off'));
check('a smelting recipe of steel and sulfur, at a smelter, kept to Volcano Isle', recipe.station === 'smelter' && recipe.isle === 'Volcano'
  && recipe.inputs.some((i) => i.item === 'steel_lump') && recipe.inputs.some((i) => i.item === 'sulfur'));

/* ---- its cap ------------------------------------------------------------------------------------------------------- */

const caps = new Map(said('CAP').map((r) => { const [d, e, n] = r.split(':'); return [`${d}:${e}`, Number(n)]; }));
for (const [id, extra, want] of [['long_sword', FIRE_STEEL_NAME, FIRE_STEEL_CAP], ['long_sword', 'Steel', 0], ['pickaxe', FIRE_STEEL_NAME, FIRE_STEEL_CAP],
  ['firesteel_lump', FIRE_STEEL_NAME, 0]] as Array<[string, string, number]>) {
  check(`${extra.toLowerCase()} ${id.replace(/_/g, ' ')}: improve cap +${want} on both sides`, caps.get(`${id}:${extra}`) === want
    && fireSteelCapOf({ id, extra }) === want, `${caps.get(`${id}:${extra}`)}`);
}
const [fireAt, steelAt] = one('IMPROVE').split('|');
check(`a weapon at its smith's skill + 3: ${FIRE_STEEL_NAME.toLowerCase()} improves, steel is capped`, fireAt === '-' && steelAt === 'QL capped by your weaponsmithing.', one('IMPROVE'));
check(`and ${FIRE_STEEL_NAME.toLowerCase()} capped at the skill + ${FIRE_STEEL_CAP}`, said('IMPROVE')[1] === 'QL capped by your weaponsmithing.|-', said('IMPROVE')[1]);

/* ---- what they do -------------------------------------------------------------------------------------------------- */

const blind = said('BLIND').map((r) => r.split('|'));
check(`an ash wraith's blow: hit chance ×${ASH_BLIND_HIT} for ${ASH_BLIND_SECS} s; a golem's does not blind; over once its time is up`,
  blind[0]?.[0] === '1' && blind[1]?.[0] === 'true' && blind[1]?.[1] === String(ASH_BLIND_HIT) && Number(blind[1]?.[2]) < Number(blind[0]?.[1])
    && Number(blind[1]?.[3]) === ASH_BLIND_SECS && blind[2]?.[0] === 'false' && blind[3]?.[0] === '1' && blind[3]?.[1] === blind[0]?.[1], said('BLIND').join(' '));
const [burnGolem, burnHound] = one('BURN').split('|');
check('a burn on a magma golem: none; on a cinder hound: one', burnGolem === '-' && burnHound !== '-', one('BURN'));
const frost = said('FROST').map((r) => r.split('|'));
check(`a Razoredge on a magma golem: ×${FROST_WEAK}; on a hound, or plain steel, ×1; an Emberbrand ×1`,
  frost[0]?.join('|') === `${FROST_WEAK}|1|1|${FROST_WEAK}` && frost[1]?.[0] === '1', said('FROST').join(' '));
check('a go at mining and the lairs\' clock carry the rules', one('PATCHED') === 'true|true', one('PATCHED'));

/* ---- the field guide ----------------------------------------------------------------------------------------------- */

for (const id of VOLCANO_KINDS) {
  const text = guidePage(SPECIES[id], true).flatMap((s) => s.lines).join(' | ');
  check(`${SPECIES[id].name}'s page: not a wildermon, its vent, only on Volcano Isle, its obsidian`,
    text.includes('Cannot be tamed, trapped, bred or kept') && text.includes(`Lair: ${VENTS.find((k) => k.species === id)!.name.toLowerCase()}`)
      && text.includes('Only on Volcano Isle') && text.includes(`up to ${obsidianOf(id)} × obsidian`), text);
}

finish('Volcano Isle: its monsters, obsidian, the seryll\'s summons, sulfur, fire-tempered steel');
