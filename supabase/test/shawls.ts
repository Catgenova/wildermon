/**
 * Sleeves are shawls (`20261120000010_a_shawl_covers_the_arms.sql`, `20261120000011_sleeves_become_shawls.sql`).
 *
 * Asked for: "Change the 'sleeves' equipment type to 'shawl' type. All existing crafted sleeves become shawls. Amend
 * the plate shawl to include metal, fur in ingredients." So:
 *
 *   * the rulebook: the slot `shawl` ("Shawl") where `arms` was, the five pieces in it, a blow to the arms on it
 *     (`hit_location.worn`, `COVERS`) at the arms' share, and the recipes and moulds under their new ids;
 *   * a world planted with the old ids, inside a transaction it rolls back -- chain sleeves worn, leather sleeves in
 *     the pack, scale sleeves in a crate, cloth sleeves for sale on a stall, plate arms and their mould in the pack,
 *     a casting of plate arms in the pack and another cooling in a smelter, a sleeves recipe queued, known, on the
 *     toolbelt, in the ledger and the tally, a buy order and a sale -- comes out of the migration with shawls in every
 *     one of those places, worn in the shawl slot, and every other column of every row as it was; nothing anywhere
 *     still names an old id; run again, it changes nothing;
 *   * a blow to the arms lands on the shawl worn (`hurt_player`), the shawl counts in what you wear (`worn_kg`) and
 *     stays on the body at a death (`bury`);
 *   * a casting of a plate shawl is refused at the anvil without its fur, in the browser's words
 *     (`mouldAlsoRefusal`); with it, the shawl comes out of the casting's metal and the fur is spent; a failed go
 *     spends none.
 *
 *   npx esbuild supabase/test/shawls.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/shawls.mjs && node node_modules/.cache/shawls.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARMOUR, COVERS, HIT_LOCATIONS, SLOT_NAMES, SLOTS } from '../../src/game/gear';
import { itemDef } from '../../src/game/items';
import { MOULD_BY_ID, MOULD_BY_MAKES } from '../../src/game/metal';
import { mouldAlsoRefusal } from '../../src/game/anvil';
import { RECIPE_BY_ID, RECIPE_RENAMED, recipeNow } from '../../src/game/recipes';
import { psql, check, finish } from './harness';

const MIGRATION = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261120000011_sleeves_become_shawls.sql'), 'utf8');
const RENAMED: Record<string, string> = {
  cloth_sleeves: 'cloth_shawl', leather_sleeves: 'leather_shawl', chain_sleeves: 'chain_shawl', scale_sleeves: 'scale_shawl',
  plate_arms: 'plate_shawl', chain_sleeves_mould: 'chain_shawl_mould', plate_arms_mould: 'plate_shawl_mould',
};
const OLD = '(cloth|leather|chain|scale)_sleeves|plate_arms';
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const said = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

/* ---- the rulebook, both sides ---------------------------------------------------------------------------- */

const SHAWLS = ['cloth_shawl', 'leather_shawl', 'chain_shawl', 'plate_shawl', 'scale_shawl'];
check('the slot is shawl, called Shawl, and arms is no slot', SLOTS.includes('shawl') && SLOT_NAMES.shawl === 'Shawl' && !(SLOTS as string[]).includes('arms'));
check('a blow to the arms lands on the shawl, at the share it had', COVERS.arms === 'shawl' && HIT_LOCATIONS.find(([p]) => p === 'arms')?.[1] === 0.16);
check('the five shawls are worn in it, and nothing else is',
  ARMOUR.filter((a) => a.slot === 'shawl').map((a) => a.id).sort().join() === [...SHAWLS].sort().join());
check('called Cloth shawl, Leather shawl, Chain shawl, Plate shawl, Scale shawl',
  SHAWLS.map((id) => itemDef(id).name).join() === 'Cloth shawl,Leather shawl,Chain shawl,Plate shawl,Scale shawl');
check('every recipe renamed is a recipe under its new id and none under its old',
  Object.entries(RECIPE_RENAMED).every(([was, now]) => RECIPE_BY_ID.has(now) && !RECIPE_BY_ID.has(was) && recipeNow(was) === now)
    && recipeNow('make_cloth_tunic') === 'make_cloth_tunic');
const PLATE = MOULD_BY_MAKES.get('plate_shawl');
check('the plate shawl is still cast in its mould from metal lumps, and takes fur at the anvil',
  !!PLATE && PLATE.id === 'plate_shawl_mould' && PLATE.lumps > 0 && PLATE.also?.item === 'fur' && (PLATE.also?.count ?? 0) > 0,
  JSON.stringify(PLATE));
check('the chain shawl\'s mould is the chain shawl mould', MOULD_BY_ID.get('chain_shawl_mould')?.makes === 'chain_shawl');

const rules = said(psql(`
select 'SLOTS=' || string_agg(id || ':' || slot, ',' order by id) from armour_def where id = any (array[${SHAWLS.map(q).join(', ')}]);
select 'COVER=' || string_agg(slot || ':' || worn || ':' || share, ',' order by ord) from hit_location;
select 'MOULD=' || makes || ':' || coalesce(also_item, '-') || ':' || also_n || ':' || lumps from mould_def where id = 'plate_shawl_mould';
select 'OLD=' || count(*) from item_def where id ~ '${OLD}';
select 'OLDR=' || count(*) from recipe where id ~ '${OLD}' or result ~ '${OLD}';
select 'NEWR=' || string_agg(id, ',' order by id) from recipe where id = any (array[${Object.values(RECIPE_RENAMED).map(q).join(', ')}]);
`));
check('the island wears the five in the shawl slot', rules.get('SLOTS') === SHAWLS.slice().sort().map((id) => `${id}:shawl`).join(','), rules.get('SLOTS'));
check('the island lands a blow where the browser does, each on the slot over it',
  rules.get('COVER') === HIT_LOCATIONS.map(([p, s]) => `${p}:${COVERS[p]}:${s}`).join(','), rules.get('COVER'));
check('the island casts the plate shawl from the same lumps and asks the same fur',
  rules.get('MOULD') === `plate_shawl:${PLATE?.also?.item}:${PLATE?.also?.count}:${PLATE?.lumps}`, rules.get('MOULD'));
check('the island has no sleeves or plate arms left in its rulebook', rules.get('OLD') === '0' && rules.get('OLDR') === '0');
check('and the renamed recipes under their new ids', rules.get('NEWR') === Object.values(RECIPE_RENAMED).sort().join(','), rules.get('NEWR'));

/* ---- a world of sleeves, carried across ------------------------------------------------------------------- */

/** Every row of the tables the migration reads, as text, keyed by table and its own key. */
const SNAP = (into: string): string => `
create temp table ${into} as
  select 'item' as t, id::text as k, to_jsonb(r) as v from item r
  union all select 'player', world_id || '/' || uid, to_jsonb(r) from player r
  union all select 'creature', world_id || '/' || id, to_jsonb(r) from creature r
  union all select 'placed', id::text, to_jsonb(r) from placed r
  union all select 'sale', world_id || '/' || n, to_jsonb(r) from sale r
  union all select 'buy_order', world_id || '/' || n, to_jsonb(r) from buy_order r
  union all select 'barter_item', ctid::text, to_jsonb(r) from barter_item r
  union all select 'away_tally', world_id || '/' || uid || '/' || what || '/' || def, to_jsonb(r) from away_tally r
  union all select 'deed_work', world_id || '/' || id, to_jsonb(r) from deed_work r
  union all select 'recipe_known', world_id || '/' || uid || '/' || recipe, to_jsonb(r) from private.recipe_known r;`;

const out = said(psql(`
begin;
set local client_min_messages = warning;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; v_crate int; v_stall bigint; v_smelter bigint; v_worn bigint; v_pack bigint; v_mould bigint;
        v_cast bigint; v_tunic bigint;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  -- Worn: chain sleeves of iron, damaged, rare, enchanted, made by a smith; a cloth tunic beside them.
  insert into item (world_id, holder, holder_uid, def, ql, dmg, extra, rare, enchant, maker, mark)
    values (w, 'player', u, 'chain_sleeves', 63.5, 17, 'Iron', 'rare', '{"id": "stoneskin", "power": 41}', 'Smith',
            '{"knack": "chain_sleeves"}') returning id into v_worn;
  insert into item (world_id, holder, holder_uid, def, ql, dye) values (w, 'player', u, 'cloth_tunic', 30, '#884422')
    returning id into v_tunic;
  update player set equipped = jsonb_build_object('arms', v_worn, 'chest', v_tunic),
         act_queue = jsonb_build_array(jsonb_build_object('action', 'make_cloth_sleeves', 'target', jsonb_build_object('kind', 'item', 'uid', 7), 'goes', 3, 'was', 'cloth')),
         belt = jsonb_build_array('make_leather_sleeves', 'make_plate_arms_mould'),
         ledger = coalesce(ledger, '{}'::jsonb) || '{"plate_arms": {"n": 2, "best": 40.5, "rare": 0, "first": 1, "bestAt": 1}}',
         tally = coalesce(tally, '{}'::jsonb) || '{"made:plate_arms": 2, "made:cloth_sleeves": 1}'
   where world_id = w and uid = u;
  -- In the pack: leather sleeves dyed, plate arms of gold, their mould worn down, a casting of plate arms in bronze.
  insert into item (world_id, holder, holder_uid, def, ql, dmg, dye) values (w, 'player', u, 'leather_sleeves', 44, 3, '#112233')
    returning id into v_pack;
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, 'plate_arms', 71, 'Gold');
  insert into item (world_id, holder, holder_uid, def, ql, dmg) values (w, 'player', u, 'plate_arms_mould', 55, 38) returning id into v_mould;
  insert into item (world_id, holder, holder_uid, def, ql, extra, piece) values (w, 'player', u, 'casting', 48, 'Bronze', 'plate_arms')
    returning id into v_cast;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'chain_sleeves_mould', 20);
  -- In a crate: scale sleeves. On a stall, for sale: cloth sleeves.
  select coalesce(max(id), 0) + 1 into v_crate from crate where world_id = w;
  insert into crate (world_id, id, kind, x, y, made_by) values (w, v_crate, 'plank', 3, 3, u);
  insert into item (world_id, holder, crate, def, ql) values (w, 'crate', v_crate, 'scale_sleeves', 90);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'stall', 4, 4, 0, 0, 4.25, 4.25, 30, u) returning id into v_stall;
  insert into item (world_id, holder, placed, def, ql, price) values (w, 'furniture', v_stall, 'cloth_sleeves', 25, 120);
  -- Cooling in a smelter: a casting of plate arms, poured from iron.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 5, 5, 0, 0, 5.375, 5.25, 50, 600, true,
            jsonb_build_object('jobs', jsonb_build_array(jsonb_build_object('def', 'casting', 'piece', 'plate_arms', 'extra', 'Iron', 'ql', 33, 'by', u)), 'output', '[]'::jsonb), u)
    returning id into v_smelter;
  -- Known, sold, ordered, counted away.
  insert into private.recipe_known (world_id, uid, recipe) values (w, u, 'make_scale_sleeves');
  insert into sale (world_id, n, def, count, silver, ql) overriding system value values (w, 999001, 'leather_sleeves', 1, 80, 40);
  insert into buy_order (world_id, n, poster, def, ql, want, price, x, y) overriding system value values (w, 999002, u, 'plate_arms', 20, 2, 300, 4, 4);
  insert into away_tally (world_id, uid, what, def, n, silver) values (w, u, 'sold', 'chain_sleeves', 1, 50);
  insert into said values ('W', w::text), ('U', u::text), ('WORN', v_worn::text), ('PACK', v_pack::text), ('MOULD', v_mould::text),
    ('CAST', v_cast::text), ('SMELTER', v_smelter::text), ('TUNIC', v_tunic::text);
end $$;
${SNAP('was')}

${MIGRATION}

${SNAP('now')}
create function pg_temp.shawled(t text) returns text language sql immutable as $fn$
  select ${Object.entries(RENAMED).filter(([k]) => !k.endsWith('_mould')).reduce((e, [a, b]) => `replace(${e}, ${q(a)}, ${q(b)})`, 't')}
$fn$;
-- Each row as it was with the old ids made new, its key too (and, for a body, what it wore in the arms slot worn in the shawl slot).
create temp table want as
  select t, pg_temp.shawled(k) as k, case when t = 'player' and v->'equipped' ? 'arms'
                    then jsonb_set(pg_temp.shawled(v::text)::jsonb, '{equipped}', ((v->'equipped') - 'arms') || jsonb_build_object('shawl', v->'equipped'->'arms'))
                    else pg_temp.shawled(v::text)::jsonb end as v
    from was;
insert into said select 'ROWS', (select count(*) from was) || ':' || (select count(*) from now);
insert into said select 'DIFF', coalesce(string_agg(coalesce(a.t, b.t) || ' ' || coalesce(a.k, b.k), '; '), 'none')
  from want a full join now b on b.t = a.t and b.k = a.k where a.v is distinct from b.v;
insert into said select 'CHANGED', count(*) from was a join now b on b.t = a.t and b.k = a.k where a.v is distinct from b.v;

do $$
declare w uuid := (select v from said where k = 'W'); u uuid := (select v from said where k = 'U'); r record; v_n bigint; v_left text := '';
begin
  insert into said select 'WORE', (select equipped::text from player where world_id = w and uid = u);
  insert into said select 'WORN_ITEM', (select def || '|' || ql || '|' || dmg || '|' || extra || '|' || rare || '|' || (enchant->>'id') || '|' || maker
    from item where id = (select v from said where k = 'WORN')::bigint);
  insert into said select 'PACK_ITEM', (select def || '|' || ql || '|' || dmg || '|' || dye from item where id = (select v from said where k = 'PACK')::bigint);
  insert into said select 'MOULD_ITEM', (select def || '|' || ql || '|' || dmg from item where id = (select v from said where k = 'MOULD')::bigint);
  insert into said select 'CAST_ITEM', (select def || '|' || piece || '|' || extra || '|' || ql from item where id = (select v from said where k = 'CAST')::bigint);
  insert into said select 'FURNACE', (select state->'jobs'->0->>'piece' from placed where id = (select v from said where k = 'SMELTER')::bigint);
  insert into said select 'QUEUE', (select act_queue->0->>'action' || '|' || (act_queue->0->>'goes') from player where world_id = w and uid = u);
  insert into said select 'BELT', (select belt::text from player where world_id = w and uid = u);
  insert into said select 'LEDGER', (select (ledger ? 'plate_shawl')::text || '|' || (ledger ? 'plate_arms')::text || '|' || (ledger->'plate_shawl'->>'n')
    || '|' || (tally->>'made:plate_shawl') || '|' || (tally->>'made:cloth_shawl') from player where world_id = w and uid = u);
  insert into said select 'KNOWN', (select string_agg(recipe, ',') from private.recipe_known where world_id = w and uid = u and recipe ~ 'scale_');
  insert into said select 'TRADE', (select s.def from sale s where s.world_id = w and s.n = 999001) || '|' || (select b.def from buy_order b where b.world_id = w and b.n = 999002)
    || '|' || (select string_agg(def, ',') from away_tally where world_id = w and uid = u and what = 'sold');
  insert into said select 'HELD', (select string_agg(def || ':' || holder, ',' order by def) from item where world_id = w and def ~ 'shawl');
  -- Nothing anywhere names an old id, but what is said of the past: the log, and the keeper's notes.
  for r in select c.table_schema s, c.table_name t, c.column_name col from information_schema.columns c
             join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
            where c.table_schema in ('public', 'private') and c.data_type in ('text', 'jsonb', 'ARRAY')
              and c.table_name not in ('event', 'owner_log', 'watch_flag', 'tick_fault', 'client_error', 'letter') loop
    execute format('select count(*) from %I.%I where %I::text ~ %L', r.s, r.t, r.col, '${OLD}') into v_n;
    if v_n > 0 then v_left := v_left || r.s || '.' || r.t || '.' || r.col || ':' || v_n || ' '; end if;
  end loop;
  insert into said values ('LEFT', coalesce(nullif(v_left, ''), 'none'));
end $$;

-- And again: nothing more to carry across.
drop table if exists again;
${SNAP('again')}
${MIGRATION}
insert into said select 'AGAIN', count(*) from again a full join (select * from now) b on b.t = a.t and b.k = a.k where a.v is distinct from b.v;
select k || '=' || v from said order by k;
rollback;
`));

check('a world of sleeves planted and carried across', (out.get('ROWS') ?? '').split(':').every((n) => Number(n) > 0), out.get('ROWS'));
check('every row of every table read is as it was, with the old ids made new and the arms worn as the shawl',
  out.get('DIFF') === 'none', out.get('DIFF'));
check('and those that held an old id are the ones changed', Number(out.get('CHANGED')) > 0, out.get('CHANGED'));
check('the chain sleeves worn are worn in the shawl slot', (() => {
  const e = JSON.parse(out.get('WORE') ?? '{}') as Record<string, number>;
  return String(e.shawl) === out.get('WORN') && !('arms' in e) && String(e.chest) === out.get('TUNIC');
})(), out.get('WORE'));
check('a chain shawl now, its quality, damage, metal, rarity, enchantment and maker kept',
  out.get('WORN_ITEM') === 'chain_shawl|63.5|17|Iron|rare|stoneskin|Smith', out.get('WORN_ITEM'));
check('the leather sleeves in the pack: a leather shawl, damage and dye kept', out.get('PACK_ITEM') === 'leather_shawl|44|3|#112233', out.get('PACK_ITEM'));
check('the plate arms mould: a plate shawl mould, as worn as it was', out.get('MOULD_ITEM') === 'plate_shawl_mould|55|38', out.get('MOULD_ITEM'));
check('the casting of plate arms in the pack: of a plate shawl, its metal kept', out.get('CAST_ITEM') === 'casting|plate_shawl|Bronze|48', out.get('CAST_ITEM'));
check('and the one cooling in the smelter', out.get('FURNACE') === 'plate_shawl', out.get('FURNACE'));
check('the sleeves queued: the shawl, the same goes', out.get('QUEUE') === 'make_cloth_shawl|3', out.get('QUEUE'));
check('on the toolbelt', out.get('BELT') === '["make_leather_shawl", "make_plate_shawl_mould"]', out.get('BELT'));
check('in the ledger and the tally, under the new ids alone', out.get('LEDGER') === 'true|false|2|2|1', out.get('LEDGER'));
check('known', out.get('KNOWN') === 'make_scale_shawl', out.get('KNOWN'));
check('for sale, ordered and counted away', out.get('TRADE') === 'leather_shawl|plate_shawl|chain_shawl', out.get('TRADE'));
check('worn, packed, crated and on a stall', ['chain_shawl:player', 'cloth_shawl:furniture', 'leather_shawl:player', 'plate_shawl:player', 'scale_shawl:crate']
  .every((x) => (out.get('HELD') ?? '').split(',').includes(x)), out.get('HELD'));
check('nothing on the island still names a sleeves or plate arms', out.get('LEFT') === 'none', out.get('LEFT'));
check('run again, it changes nothing', out.get('AGAIN') === '0', out.get('AGAIN'));

/* ---- a shawl worn, struck, weighed and buried -------------------------------------------------------------- */

const body = said(psql(`
begin;
set local client_min_messages = warning;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; v_sh bigint; v_stick bigint; v_px double precision; v_py double precision; tx int; ty int; d record;
begin
  perform setseed(0.31);
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into d
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  w := d.world_id; u := d.uid;
  v_px := case when d.spawn_x + peace_reach() + 6 < d.size then d.spawn_x + peace_reach() + 6.5 else d.spawn_x - peace_reach() - 5.5 end;
  v_py := d.spawn_y + 0.5;
  for tx in greatest(0, floor(v_px)::int - 3)..least(d.size - 1, floor(v_px)::int + 3) loop
    for ty in greatest(0, floor(v_py)::int - 3)..least(d.size - 1, floor(v_py)::int + 3) loop
      perform land_set_height(w, tx, ty, 4); perform land_set_dirt(w, tx, ty, 5); perform land_set_tile(w, tx, ty, tile_id('Grass'));
    end loop;
  end loop;
  update player set body_at = now(), x = v_px - 60 where world_id = w and uid <> u and (x - v_px) ^ 2 + (y - v_py) ^ 2 < 60 ^ 2;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, 'chain_shawl', 50, 'Iron') returning id into v_sh;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null, act_queue = '[]'::jsonb,
         equipped = jsonb_build_object('shawl', v_sh), fight_stance = 'balanced', fight_back = false, x = v_px, y = v_py, level = 0,
         wounds = '[]'::jsonb, away = false, blessings = '{}'::jsonb, craft_class = null, combat_class = null, class_mul = null,
         stats = (coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)) - 'hurtAt' - 'hurtBy'
   where world_id = w and uid = u;
  delete from player_node where world_id = w and uid = u;
  update creature set hunting = null, brawl = null where world_id = w and hunting = u;
  delete from faith_zone where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'body_control', dodge_from())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into said values ('KG', worn_kg(w, u)::text);
  -- Every blow on the arms.
  update hit_location set share = case when slot = 'arms' then 1 else 0 end;
  delete from event where uid = u;
  perform hurt_player(w, u, 0.2, 'Something is on you', 'cut');
  insert into said select 'STRUCK', (select dmg::text from item where id = v_sh) || '|' || (select hurt_where from player where world_id = w and uid = u)
    || '|' || (select wounds->0->>'part' from player where world_id = w and uid = u)
    || '|' || coalesce((select text from event where uid = u and kind = 'fight' order by n desc limit 1), 'unsaid');
  -- Broken on the arms: off the shawl slot.
  update item set dmg = 99.99 where id = v_sh;
  perform hurt_player(w, u, 0.2, 'Something is on you', 'cut');
  insert into said select 'BROKE', (select count(*) from item where id = v_sh)::text || '|' || (select equipped::text from player where world_id = w and uid = u);
  -- A death: the shawl stays on the body, the stick goes in the grave.
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, 'chain_shawl', 50, 'Iron') returning id into v_sh;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'shaft', 10) returning id into v_stick;
  update player set equipped = jsonb_build_object('shawl', v_sh) where world_id = w and uid = u;
  perform bury(w, u);
  insert into said select 'BURIED', (select holder from item where id = v_sh) || '|' || (select holder from item where id = v_stick)
    || '|' || (select equipped::text from player where world_id = w and uid = u);
end $$;
select k || '=' || v from said order by k;
rollback;
`));
check('a chain shawl worn counts at its weight in what you wear', Math.abs(Number(body.get('KG')) - itemDef('chain_shawl').weight) < 1e-6, body.get('KG'));
check('a blow to the arms lands on the shawl worn: it takes damage, the wound is on the arm, and it says so',
  Number((body.get('STRUCK') ?? '').split('|')[0]) > 0 && (body.get('STRUCK') ?? '').split('|').slice(1, 3).join() === 'arms,arms'
    && (body.get('STRUCK') ?? '').includes('(chain shawl absorbed some)'), body.get('STRUCK'));
check('broken there, it is gone from the shawl slot', body.get('BROKE') === '0|{}', body.get('BROKE'));
check('a death leaves the shawl on the body', (body.get('BURIED') ?? '').startsWith('player|furniture|') && (body.get('BURIED') ?? '').includes('"shawl"'),
  body.get('BURIED'));

/* ---- the plate shawl at the anvil --------------------------------------------------------------------------- */

const FUR = PLATE?.also?.count ?? 0;
const anvil = said(psql(`
begin;
set local client_min_messages = warning;
create temp table said (k text, v text);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $$
declare w uuid; u uuid; tx int; ty int; v_anvil bigint; v_cast bigint; v_t jsonb;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_dirt(w, tx, ty, 20);
    perform land_set_tile(w, tx, ty, tile_id('Dirt')); perform land_set_data(w, tx, ty, 0);
  end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from player_node where world_id = w and uid = u;
  delete from placed where world_id = w and x between 6 and 15 and y between 6 and 13;
  delete from crate where world_id = w and x between 6 and 15 and y between 6 and 13;
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, smith_tool(), 50, 'Iron');
  update player set x = 9.5, y = 9.5, act = null, act_target = null, act_queue = '[]', craft_class = null, combat_class = null,
         class_mul = null, equipped = '{}'::jsonb, craft_from_stores = true, craft_spare_rare = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into skill (world_id, uid, id, value) values (w, u, 'platesmithing', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'anvil', 'iron', 9, 10, 0, 0, 9.25, 10.25, 50, u) returning id into v_anvil;
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, piece) values (w, 'player', u, 'casting', 50, 1, 'Copper', 'plate_shawl')
    returning id into v_cast;
  v_t := jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', v_cast);
  -- One fur short.
  perform give(w, u, 'fur', ${FUR - 1}, 30);
  insert into said values ('SHORT', coalesce(act_refusal(w, u, 'smith', v_t), 'ALLOWED'));
  -- Enough, but the go fails: the casting is damaged, no fur spent.
  perform give(w, u, 'fur', 2, 30);
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
    p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select false';
  insert into said values ('ENOUGH', coalesce(act_refusal(w, u, 'smith', v_t), 'ALLOWED'));
  perform act_perform(w, u, 'smith', v_t);
  insert into said select 'FAILED', (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'fur')
    || '|' || (select count(*) from item where id = v_cast);
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
    p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
  perform act_perform(w, u, 'smith', v_t);
  insert into said select 'MADE', (select coalesce(string_agg(def || ':' || extra, ','), 'none') from item where world_id = w and holder = 'player' and holder_uid = u and def = 'plate_shawl')
    || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'fur')
    || '|' || (select count(*) from item where id = v_cast)
    || '|' || coalesce((select text from event where uid = u and text like 'Smithed:%' order by n desc limit 1), 'unsaid');
end $$;
select k || '=' || v from said order by k;
rollback;
`));
const SAYS = PLATE ? mouldAlsoRefusal(PLATE, FUR - 1) : null;
check(`one fur short, the anvil refuses in the browser's words: "${SAYS}"`, !!SAYS && anvil.get('SHORT') === SAYS, anvil.get('SHORT'));
check('with enough at hand, it is allowed', anvil.get('ENOUGH') === 'ALLOWED' && PLATE != null && mouldAlsoRefusal(PLATE, FUR) === null, anvil.get('ENOUGH'));
check('a failed go spends no fur and keeps the casting', anvil.get('FAILED') === `${FUR + 1}|1`, anvil.get('FAILED'));
check(`a go that lands: a copper plate shawl, ${FUR} fur and the casting spent`,
  anvil.get('MADE')?.startsWith(`plate_shawl:Copper|1|0|Smithed: copper plate shawl, QL`) === true, anvil.get('MADE'));

finish('Sleeves are shawls');
