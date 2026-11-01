/*
 * The Bura is the Packlet line, and its panniers are a store.
 *
 * Asked for, with a reference sheet: Packlet, Haulbud, Cargocrest. The kind's name, its old one (`was`), its two
 * stages' names, its words, and its line's own skill at its third stage, speed +5% (`species_def.perk` 'blood',
 * `perk_channel` 'speed', which `evo_perk` already reads), come over in the definitions before this
 * (`20261101180000_defs.sql`), with what its panniers hold at each stage (`species_def.panniers`: 200, 500, 1000).
 *
 * And asked for, of its panniers, which the island has never run:
 *
 *   * "Pannier capacity by stage: 200 items at stage 1, 500 at stage 2, 1000 at stage 3": `pannier_cap`, its stage's
 *     times its blood's hauling (`beast_mul`, the browser's `bloodMul`), as the browser's panniers always were.
 *   * "Its panniers open like a storage container": a thing in them is an item held by 'pannier', the beast's id in
 *     `item.pannier`. In by `store_in_pannier` (`pannier_act_refusal`, `perform_pannier`), out by `take_from_store`
 *     (`crate_refusal`, `perform_crate`, by `pannier_take`), and sent to whoever they open for with the beast
 *     (`pannier_sent`, in `rpc_creatures`). They open for its keeper, and for anybody whose rank may use the stores on
 *     a settlement of its keeper's that it stands on, as a chest standing there would (`pannier_shut`); and from as
 *     near as a chest is reached from (`pannier_refusal`).
 *   * "Its panniers count as nearby storage": `craft_stock` (crafting and every station's work from the stores) and
 *     `hod_stock` (building) take from the panniers of any beast within reach that they open for, after the crates
 *     and pieces at the same distance, as the browser's `Game.storesWithin` does.
 *   * "It cannot be crated or released unless its panniers are empty": `crate_creature`, `release_creature` and
 *     `cull_creature` are refused while anything is in them, and so is sending it into a crate to make way for another
 *     (`companion_swap`, for `take_creature`; `crate_open_refusal`, for `crate_follow`), all in one set of words
 *     (`pannier_exit_said`). A crated one never has anything in its panniers, so a deal, a parcel or a stall of one
 *     needs nothing more.
 *
 * Where it leaves your keeping without being asked -- turned loose by its settlement going (`perform_settlement`),
 * its post (`post_release`) or its work (`worker_settle`) -- what is in its panniers is set down where it stands
 * (`pannier_dropped`). And on its death, by any road, what is in them goes with it (`pannier_lost`): what the browser
 * has always done with a beast's panniers when it dies.
 */
set local lock_timeout = '3s';

/* ---- where a thing in panniers is ------------------------------------------------- */

alter table item add column if not exists pannier integer;
create index if not exists item_in_pannier on item (world_id, pannier) where holder = 'pannier';

-- Out of the panniers by any road (`move_part`, a drop, a trade), it is in nobody's panniers.
create or replace function private.pannier_left() returns trigger language plpgsql as $fn$
begin
  new.pannier := null;
  return new;
end $fn$;
drop trigger if exists item_pannier_left on item;
create trigger item_pannier_left before insert or update of holder on item
  for each row when (new.pannier is not null and new.holder <> 'pannier') execute function private.pannier_left();

-- Dead, by any road: what is in its panniers goes with it, as it always did in the browser.
create or replace function private.pannier_lost() returns trigger language plpgsql as $fn$
begin
  delete from item i using gone g
   where i.world_id = g.world_id and i.holder = 'pannier' and i.pannier = g.id;
  return null;
end $fn$;
drop trigger if exists creature_pannier_lost on creature;
create trigger creature_pannier_lost after delete on creature
  referencing old table as gone for each statement execute function private.pannier_lost();

-- Gone wild without being let go (its settlement, its post or its work gone): what is in them is set down where it stands.
create or replace function private.pannier_dropped() returns trigger language plpgsql as $fn$
begin
  update item set holder = 'ground', holder_uid = null, gx = floor(creature_x(new))::int, gy = floor(creature_y(new))::int
   where world_id = new.world_id and holder = 'pannier' and pannier = new.id;
  return null;
end $fn$;
drop trigger if exists creature_pannier_dropped on creature;
create trigger creature_pannier_dropped after update of mode on creature
  for each row when (new.mode = 'wild' and old.mode <> 'wild') execute function private.pannier_dropped();

/* ---- what they hold, and whose they are ------------------------------------------ */

-- What its panniers hold: its stage's (`species_def.panniers`), times its blood's hauling. The browser's `pannierCap`.
create or replace function pannier_cap(c creature) returns integer language sql stable as $fn$
  select coalesce(floor(d.panniers[stage_of(c) + 1] * beast_mul(c, 'haul') + 0.5)::int, 0)
    from species_def d where d.id = c.species
$fn$;

-- How many things are in them. The browser's `pannierUnits`.
create or replace function pannier_units(p_world uuid, p_id integer) returns integer language sql stable as $fn$
  select coalesce(sum(i.count), 0)::int from item i where i.world_id = p_world and i.holder = 'pannier' and i.pannier = p_id
$fn$;

-- Full. The browser's `pannierFullSaid`.
create or replace function pannier_full_said(c creature) returns text language sql immutable as $fn$
  select c.name || '''s panniers full.'
$fn$;

-- Every way out of your keeping, while anything is in them. The browser's `pannierExitSaid`.
create or replace function pannier_exit_said(p_name text) returns text language sql immutable as $fn$
  select p_name || ': empty its panniers first.'
$fn$;

-- Why it may not go into a crate, be let go or culled: something in its panniers. The browser's `pannierExitRefusal`.
create or replace function pannier_exit_refusal(p_world uuid, c creature) returns text language sql stable as $fn$
  select case when pannier_units(p_world, c.id) > 0 then pannier_exit_said(c.name) end
$fn$;

/*
 * Whose they are to open: its keeper's, while it is out of a crate; and anybody's whose rank may use the stores
 * (`power_bit('stores')`) on a settlement of its keeper's that it stands on, as a chest standing there opens
 * (`crate_yours`). The browser has this as `panniersOpen`: the island sends the panniers only where they open.
 */
create or replace function pannier_shut(p_world uuid, p_uid uuid, c creature) returns text language sql stable as $fn$
  select case
    when c.mode in ('active', 'deed') and c.keeper = p_uid then null
    when c.mode in ('active', 'deed') and c.keeper is not null and exists (
           select 1 from deeds_of(p_world, c.keeper) d
            where deed_covers(d, floor(creature_x(c))::int, floor(creature_y(c))::int)
              and deed_may(p_world, d.founded_by, p_uid, power_bit('stores'))) then null
    else 'Not yours: ' || c.name || '''s panniers.' end
$fn$;

-- Why its panniers will not open for you: gone, none, in a crate, not yours, too far. The browser's `pannierRefusal`.
create or replace function pannier_refusal(p_world uuid, p_uid uuid, c creature) returns text language sql stable as $fn$
  select case
    when c.world_id is null then 'Gone.'
    when (select sd.panniers from species_def sd where sd.id = c.species) is null
      then (select sd.name from species_def sd where sd.id = c.species) || ': no panniers.'
    when c.mode = 'stored' then c.name || ' is in a wildermon crate: open it first.'
    when pannier_shut(p_world, p_uid, c) is not null then pannier_shut(p_world, p_uid, c)
    -- As near as a chest is reached from (`STORE_REACH`).
    when not creature_in_reach(p_world, p_uid, c, 2.4) then 'Stand next to ' || c.name || '.'
  end
$fn$;

-- The panniers a put is aimed at: the ones it names, or the nearest of yours in reach. The browser's `pannierInto`.
create or replace function pannier_into(p_world uuid, p_uid uuid, p_target jsonb) returns creature language sql stable as $fn$
  select c.* from creature c join player p on p.world_id = c.world_id and p.uid = p_uid
   where c.world_id = p_world
     and case when p_target ? 'into' then c.id = (p_target->>'into')::int
              else c.keeper = p_uid and c.mode in ('active', 'deed')
                   and exists (select 1 from species_def d where d.id = c.species and d.panniers is not null)
                   and sqrt((creature_x(c) - p.x) ^ 2 + (creature_y(c) - p.y) ^ 2) <= 2.4 end
   order by sqrt((creature_x(c) - p.x) ^ 2 + (creature_y(c) - p.y) ^ 2), c.id
   limit 1
$fn$;

-- What is in its panniers, for whoever they open for, beside the rest of it in `rpc_creatures`.
create or replace function pannier_sent(p_world uuid, p_uid uuid, c creature) returns jsonb language sql stable as $fn$
  select coalesce((
    select jsonb_build_object('pannier', coalesce((
             select jsonb_agg(jsonb_build_object('id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg, 'count', i.count,
                                                 'extra', i.extra, 'rare', i.rare, 'dye', i.dye, 'enchant', i.enchant) order by i.id)
               from item i where i.world_id = p_world and i.holder = 'pannier' and i.pannier = c.id), '[]'::jsonb))
      from species_def d
     where d.id = c.species and d.panniers is not null and pannier_shut(p_world, p_uid, c) is null), '{}'::jsonb)
$fn$;

/* ---- in and out ------------------------------------------------------------------- */

/*
 * `count` of a stack into a beast's panniers: merged into a stack of the same thing already there, or moved, or split
 * off. `move_part` knows nothing of whose panniers, so this is its twin for them.
 */
create or replace function pannier_put(p_item bigint, p_count integer, p_beast integer) returns bigint language plpgsql as $fn$
declare it item; v_stack item; v_new bigint;
begin
  select * into it from item where id = p_item for update;
  if not found or p_count <= 0 or p_count > it.count then return null; end if;
  if coalesce((select stackable from item_def where id = it.def), false) then
    select * into v_stack from item o
     where o.world_id = it.world_id and o.holder = 'pannier' and o.pannier = p_beast and o.id <> it.id
       and o.def = it.def and o.extra is not distinct from it.extra
       and o.rare is not distinct from it.rare and o.dye is not distinct from it.dye
       and o.maker is not distinct from it.maker and o.piece is not distinct from it.piece
       and coalesce(o.locked, false) = coalesce(it.locked, false)
     order by o.id limit 1 for update;
  end if;
  if v_stack.id is not null then
    update item set ql = (v_stack.ql * v_stack.count + it.ql * p_count) / (v_stack.count + p_count),
        count = v_stack.count + p_count
      where id = v_stack.id;
    if p_count >= it.count then delete from item where id = it.id;
    else update item set count = it.count - p_count where id = it.id; end if;
    return v_stack.id;
  end if;
  if p_count = it.count then
    update item set holder = 'pannier', pannier = p_beast, holder_uid = null, inside = null, placed = null,
        gx = null, gy = null, crate = null, price = null
      where id = it.id;
    return it.id;
  end if;
  update item set count = it.count - p_count where id = it.id;
  insert into item (world_id, holder, pannier, def, ql, dmg, count, extra, rare, dye, bless, charges, locked, maker, piece,
                    origin, origin_fn, origin_uid)
  values (it.world_id, 'pannier', p_beast, it.def, it.ql, it.dmg, p_count, it.extra, it.rare, it.dye, it.bless, it.charges,
          coalesce(it.locked, false), it.maker, it.piece, coalesce(it.origin, 'before'), it.origin_fn, it.origin_uid)
  returning id into v_new;
  return v_new;
end $fn$;

-- The one door of its own: a thing from the pack into a beast's panniers.
create or replace function pannier_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action = 'store_in_pannier'
$fn$;

-- Why it will not go in. The browser's `store_in_pannier` check.
create or replace function pannier_act_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns text language plpgsql stable as $fn$
declare it item; c creature; v_why text; v_need int;
begin
  select * into it from item where world_id = p_world and id = target_item(p_target) and holder = 'player' and holder_uid = p_uid;
  if not found then return 'It is gone.'; end if;
  if crate_kind_of_item(it.def) is not null then return 'No crates in panniers.'; end if;
  c := pannier_into(p_world, p_uid, p_target);
  if c.world_id is null then return case when p_target ? 'into' then 'Gone.' else 'No panniers in reach.' end; end if;
  v_why := pannier_refusal(p_world, p_uid, c);
  if v_why is not null then return v_why; end if;
  -- A thing that stacks goes in as far as there is room; one that does not goes in whole or not at all.
  v_need := case when coalesce((select stackable from item_def where id = it.def), false) then 1
                 else greatest(1, least(it.count, coalesce((p_target->>'count')::int, 1))) end;
  if pannier_cap(c) - pannier_units(p_world, c.id) < v_need then return pannier_full_said(c); end if;
  return null;
end $fn$;

-- In: as much of it as there is room for, and the rest stays in the pack.
create or replace function perform_pannier(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns void language plpgsql as $fn$
declare it item; c creature; v_want int; v_fit int;
begin
  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid for update;
  if not found then return; end if;
  c := pannier_into(p_world, p_uid, p_target);
  if c.world_id is null then return; end if;
  -- Its row, so two puts into one beast's panniers are measured against its room one after the other.
  select * into c from creature where world_id = p_world and id = c.id for update;
  if not found or pannier_refusal(p_world, p_uid, c) is not null then return; end if;
  v_want := greatest(1, least(coalesce((p_target->>'count')::int, 1), it.count));
  v_fit := least(v_want, pannier_cap(c) - pannier_units(p_world, c.id));
  if v_fit <= 0 then
    perform tell(p_world, p_uid, pannier_full_said(c), 'error');
    return;
  end if;
  if pannier_put(it.id, v_fit, c.id) is null then return; end if;
  perform tell(p_world, p_uid, 'Stored: ' || v_fit || ' × ' || lower(item_name(it)) || ' in ' || c.name || '''s panniers.'
    || case when v_want > v_fit then ' ' || (v_want - v_fit) || ' did not fit.' else '' end, 'event');
end $fn$;

-- Why a thing will not come out of them: the panniers' own say (`take_from_store`).
create or replace function pannier_take_refusal(p_world uuid, p_uid uuid, p_item item) returns text language sql stable as $fn$
  select pannier_refusal(p_world, p_uid, (select c from creature c where c.world_id = p_world and c.id = p_item.pannier))
$fn$;

-- Out: `count` of a row into the pack (`take_from_store`).
create or replace function pannier_take(p_world uuid, p_uid uuid, p_item item, p_target jsonb) returns void language plpgsql as $fn$
declare c creature; it item; v_want int;
begin
  select * into c from creature where world_id = p_world and id = p_item.pannier for update;
  if not found or pannier_refusal(p_world, p_uid, c) is not null then return; end if;
  select * into it from item where id = p_item.id and world_id = p_world and holder = 'pannier' and pannier = c.id for update;
  if not found then return; end if;
  v_want := greatest(1, least(it.count, coalesce((p_target->>'count')::int, 1)));
  if move_part(it.id, v_want, 'player', p_uid, null, null) is null then return; end if;
  perform tell(p_world, p_uid, 'Taken from ' || c.name || '''s panniers: '
    || case when v_want > 1 then v_want || ' × ' else '' end
    || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');
end $fn$;

/* ---- the patches ------------------------------------------------------------------ */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The door is open on islands.
    ('public', 'act_ported',
     $$      or holding_action(p_action)
$$,
     $$      or holding_action(p_action)
      -- A pack beast's panniers (`panniers.ts`).
      or pannier_action(p_action)
$$),
    ('public', 'act_refusal_rules',
     $$  if holding_action(p_action) then
    return holding_refusal(p_world, p_uid, p_action, p_target);
  end if;$$,
     $$  if holding_action(p_action) then
    return holding_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A pack beast's panniers answer for their own reach and whose they are (`pannier_act_refusal`).
  if pannier_action(p_action) then
    return pannier_act_refusal(p_world, p_uid, p_action, p_target);
  end if;$$),
    ('public', 'act_perform',
     $$  if holding_action(p_action) then
    perform perform_holding(p_world, p_uid, p_action, p_target);
    return;
  end if;$$,
     $$  if holding_action(p_action) then
    perform perform_holding(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if pannier_action(p_action) then
    perform perform_pannier(p_world, p_uid, p_action, p_target);
    return;
  end if;$$),
    -- One thing out of them, as out of a chest.
    ('public', 'crate_refusal',
     $$    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return 'It is gone.'; end if;$$,
     $$    -- Out of a pack beast's panniers: theirs to say (`pannier_take_refusal`).
    if found and v_it.holder = 'pannier' then return pannier_take_refusal(p_world, p_uid, v_it); end if;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return 'It is gone.'; end if;$$),
    ('public', 'perform_crate',
     $$    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return; end if;$$,
     $$    -- Out of a pack beast's panniers (`pannier_take`).
    if found and v_it.holder = 'pannier' then
      perform pannier_take(p_world, p_uid, v_it, p_target);
      return;
    end if;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return; end if;$$),
    -- Put all in, as for a chest (`rpc_act_many`).
    ('private', 'act_many_job',
     $$'stow_item', 'take_from_store')$$,
     $$'stow_item', 'take_from_store', 'store_in_pannier')$$),
    -- Carrying a thing into them is no exercise (`TEACHES_NOTHING`).
    ('public', 'teaches_nothing',
     $$'take_from_store', 'stow_item', 'empty_bag', 'throw_away', 'equip', 'unequip',$$,
     $$'take_from_store', 'stow_item', 'empty_bag', 'throw_away', 'equip', 'unequip', 'store_in_pannier',$$),
    -- And a move, for where a thing came from.
    ('private', 'origin_act_kind',
     $$'stow_item', 'throw_away', 'equip',$$,
     $$'stow_item', 'store_in_pannier', 'throw_away', 'equip',$$),
    -- Crafting and every station's work: the panniers within reach that open for you, after crates and pieces.
    ('public', 'craft_stock',
     $$       and pl.store_of is null
  ),
  stock as ($$,
     $$       and pl.store_of is null
  ),
  -- A pack beast's panniers that open for you, by the tile it stands on (`pannier_shut`); from what is in panniers at all.
  beasts as materialized (
    select c.id, sqrt((creature_x(c) - me.x) ^ 2 + (creature_y(c) - me.y) ^ 2) as d
      from (select distinct i.pannier from item i where i.world_id = p_world and i.holder = 'pannier') b
      join creature c on c.world_id = p_world and c.id = b.pannier, me
     where me.stores and c.mode in ('active', 'deed')
       and floor(creature_x(c))::int between me.tx - me.r and me.tx + me.r
       and floor(creature_y(c))::int between me.ty - me.r and me.ty + me.r
       and same_floor(0, p_world, floor(creature_x(c))::int, floor(creature_y(c))::int) -- cellar
       and pannier_shut(p_world, p_uid, c) is null
  ),
  stock as ($$),
    ('public', 'craft_stock',
     $$      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
  )$$,
     $$      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, false, 2, bs.d, 2, bs.id::bigint
      from beasts bs join item i on i.world_id = p_world and i.holder = 'pannier' and i.pannier = bs.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
  )$$),
    -- Building: the same panniers, at a builder's reach.
    ('public', 'hod_stock',
     $$       and pl.store_of is null
  ),
  stock as ($$,
     $$       and pl.store_of is null
  ),
  beasts as materialized (
    select c.id, sqrt((creature_x(c) - me.x) ^ 2 + (creature_y(c) - me.y) ^ 2) as d
      from (select distinct i.pannier from item i where i.world_id = p_world and i.holder = 'pannier') b
      join creature c on c.world_id = p_world and c.id = b.pannier, me
     where c.mode in ('active', 'deed')
       and floor(creature_x(c))::int between me.tx - me.r and me.tx + me.r
       and floor(creature_y(c))::int between me.ty - me.r and me.ty + me.r
       and same_floor(0, p_world, floor(creature_x(c))::int, floor(creature_y(c))::int) -- cellar
       and pannier_shut(p_world, p_uid, c) is null
  ),
  stock as ($$),
    ('public', 'hod_stock',
     $$      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
  )$$,
     $$      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.count, bs.d, 2, bs.id::bigint
      from beasts bs join item i on i.world_id = p_world and i.holder = 'pannier' and i.pannier = bs.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
  )$$),
    -- Into a crate, let go or culled only with its panniers empty.
    ('public', 'creature_refusal',
     $$    if empty_crate(p_world, p_uid) is null then return 'Need an empty wildermon crate in your pack.'; end if;
    return null;$$,
     $$    if empty_crate(p_world, p_uid) is null then return 'Need an empty wildermon crate in your pack.'; end if;
    return pannier_exit_refusal(p_world, c);$$),
    ('public', 'creature_refusal',
     $$    if c.mode = 'wild' then return 'Already wild.'; end if;$$,
     $$    if c.mode = 'wild' then return 'Already wild.'; end if;
    if pannier_exit_refusal(p_world, c) is not null then return pannier_exit_refusal(p_world, c); end if;$$),
    ('public', 'creature_refusal',
     $$    if c.rider is not null then return 'Get down off ' || c.name || ' first.'; end if;
    if c.mode = 'stored' and exists$$,
     $$    if c.rider is not null then return 'Get down off ' || c.name || ' first.'; end if;
    if pannier_exit_refusal(p_world, c) is not null then return pannier_exit_refusal(p_world, c); end if;
    if c.mode = 'stored' and exists$$),
    -- The one following you sent into a crate to make way for another (`take_creature`).
    ('public', 'companion_swap',
     $$  if empty_crate(p_world, p_uid) is not null then v_to := 'crate'; return; end if;$$,
     $$  if empty_crate(p_world, p_uid) is not null then
    v_why := pannier_exit_refusal(p_world, v_cur);
    if v_why is null then v_to := 'crate'; end if;
    return;
  end if;$$),
    -- And into the crate one is let out of (`crate_follow`).
    ('public', 'crate_open_refusal',
     $$      return 'Get down off ' || v_cur.name || ' first.';
    end if;
    return null;$$,
     $$      return 'Get down off ' || v_cur.name || ' first.';
    end if;
    if v_cur.id is not null then return pannier_exit_refusal(p_world, v_cur); end if;
    return null;$$),
    -- What is in its panniers, to whoever they open for.
    ('public', 'rpc_creatures',
     $$      -- The work post it works out of, to anybody: the post is in the open.
$$,
     $$      -- What is in its panniers, to whoever they open for (`pannier_sent`).
      || pannier_sent(p_world, me, c)
      -- The work post it works out of, to anybody: the post is in the open.
$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
