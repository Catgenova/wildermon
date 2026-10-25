/*
 * Where each thing came from: every row of `item` written from now on carries
 * its origin.
 *
 *   origin      what kind of door made it (`private.origin_kind`):
 *                 craft, gather, loot, repair, move   a go of that action (`act:<action>`);
 *                 trade                               a trade, deal, stall, parcel or order door;
 *                 keeper                              a keeper's door (`rpc_owner_*`);
 *                 door                                any other `rpc_*` door;
 *                 clock                               a job of the clock (`world_tick`, ...);
 *                 migration                           a migration that sets `wurm.source` to 'migration';
 *                 none                                no door: a statement written straight against the table;
 *                 before                              every row there was before this migration.
 *   origin_fn   the door itself, as the watch names it (`private.watch_source`): `act:forage`, `rpc_deal_answer`, ...
 *   origin_uid  whose go or whose door it was: the body a go was settled for (`wurm.uid`, set by
 *               `settle`), else the caller (`auth.uid()`), else nobody.
 *
 * Written by one BEFORE INSERT trigger from what the session already holds:
 * no round trip, no other table, three columns on a row that is being written
 * anyway. A row copied off another (a stack split by `move_part`, a vessel
 * drawn off by `drain_vessel`, a post filled by `rpc_order_fill`, and the
 * whole-row copies `barter_split` and `crate_put` make) carries the origin of
 * the row it came off, so a split is never a new thing. Adding to a stack that
 * is already there is not a new row and keeps the stack's origin.
 *
 * The rows already there read 'before' without the table being rewritten: the
 * column is added with that default, which Postgres keeps as the value of
 * every older row, and the default is then dropped.
 *
 * `settle` also says when each go was due (`wurm.go_at`), which the ledger's
 * rate check reads (`20261026010200_work_faster_than_its_pace.sql`).
 */
set local lock_timeout = '3s';

select private.shut($ddl$alter table public.item add column if not exists origin text default 'before'$ddl$);
select private.shut('alter table public.item alter column origin drop default');
select private.shut('alter table public.item add column if not exists origin_fn text');
select private.shut('alter table public.item add column if not exists origin_uid uuid');

-- ------------------------------------------------------------------ who and when

/* Whose go or door this is: the body `settle` is working for, else the caller. No `search_path` of its own, so it inlines. */
create or replace function private.watch_uid() returns uuid
language sql stable as $fn$
  select coalesce(nullif(pg_catalog.current_setting('wurm.uid', true), '')::uuid, auth.uid())
$fn$;

/* When the go being settled was due, or null outside a go. Inlines, as `watch_uid` does. */
create or replace function private.watch_go_at() returns timestamptz
language sql stable as $fn$
  select pg_catalog.to_timestamp(nullif(pg_catalog.current_setting('wurm.go_at', true), '')::double precision)
$fn$;

-- ------------------------------------------------------------------ the kinds

/*
 * The kind of a go, by its action. PL/pgSQL, whose plans are kept: written in
 * SQL it was planned again on every row (0.4 ms).
 */
create or replace function private.origin_act_kind(p_act text) returns text
language plpgsql stable set search_path = public as $fn$
declare v_skill text;
begin
  if p_act = any (array['attack_creature', 'shoot_creature', 'cull_creature', 'butcher', 'investigate', 'absorb_soul',
                        'unearth', 'sacrifice']) then return 'loot'; end if;
  if p_act = any (array['repair_item', 'improve_item', 'patch_item', 'mend_kit', 'seal_item', 'glaze_item',
                        'hone_whetstone', 'restore_relic']) then return 'repair'; end if;
  if p_act = any (array['pick_up', 'pick_up_all', 'pick_up_anvil', 'pick_up_crate', 'pick_up_furniture', 'pick_up_kiln',
                        'pick_up_post', 'pick_up_smelter', 'pick_up_trap', 'drop', 'drop_cart', 'store_in_crate',
                        'store_in_furniture', 'take_from_store', 'crate_take_all', 'furniture_take_all', 'kiln_take_all',
                        'smelter_take_all', 'empty_bag', 'empty_bucket', 'empty_creel', 'empty_vessel', 'rack_put',
                        'stow_item', 'throw_away', 'equip', 'unequip', 'take_off_counter', 'set_out_goods', 'take_lamp',
                        'take_off_lock', 'take_apart_campfire', 'place_anvil', 'place_crate', 'place_furniture',
                        'place_kiln', 'place_post', 'place_smelter', 'load_kiln', 'pour_into_barrel', 'crate_creature',
                        'take_creature', 'free_catch']) then return 'move'; end if;
  if p_act = any (array['smith', 'strike_coins', 'quench_item']) or exists (select 1 from recipe r where r.id = p_act) then
    return 'craft';
  end if;
  if p_act = any (array['shear', 'milk_creature', 'take_honey', 'take_catch', 'take_ashes_fire', 'take_ashes_kiln',
                        'take_ashes_oven', 'take_ashes_smelter', 'fill_bucket', 'fill_skin', 'scrub_moss', 'clear_ivy',
                        'lift_stones', 'raise_rock', 'chip_corner', 'collect_motes']) then return 'gather'; end if;
  select a.skill into v_skill from action_def a where a.id = p_act;
  if v_skill = any (array['foraging', 'botanizing', 'digging', 'farming', 'fishing', 'forestry', 'mining', 'prospecting',
                          'woodcutting', 'animal_husbandry', 'taming', 'elementalism', 'archaeology']) then return 'gather'; end if;
  if v_skill = any (array['alchemy', 'blacksmithing', 'brewing', 'carpentry', 'cooking', 'leatherworking', 'milling',
                          'papyrusmaking', 'pottery', 'smelting', 'tailoring', 'jewellery', 'masonry', 'enchanting',
                          'paving']) then return 'craft'; end if;
  return 'act';
end $fn$;

/* The kind of door a source (`private.watch_source`) is. */
create or replace function private.origin_kind(p_fn text) returns text
language plpgsql stable set search_path = public as $fn$
begin
  if p_fn is null or p_fn = '' or p_fn = 'sql' then return 'none'; end if;
  if p_fn = 'migration' then return 'migration'; end if;
  if p_fn like 'act:%' then return private.origin_act_kind(substr(p_fn, 5)); end if;
  if p_fn like 'rpc\_owner\_%' then return 'keeper'; end if;
  if p_fn = any (array['rpc_barter_accept', 'rpc_barter_cancel', 'rpc_deal', 'rpc_deal_answer', 'rpc_buy', 'rpc_parcel',
                       'rpc_collect', 'rpc_letter', 'rpc_order', 'rpc_order_fill', 'rpc_order_cancel', 'rpc_takings']) then
    return 'trade';
  end if;
  if p_fn like 'rpc\_%' then return 'door'; end if;
  return 'clock';
end $fn$;

-- ------------------------------------------------------------------ the trigger

create or replace function private.item_origin() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  new.origin_fn := left(private.watch_source(), 63);
  new.origin := private.origin_kind(new.origin_fn);
  new.origin_uid := private.watch_uid();
  return new;
end $fn$;

select private.shut('drop trigger if exists item_origin on public.item');
select private.shut($ddl$create trigger item_origin before insert on public.item
  for each row when (new.origin is null) execute function private.item_origin()$ddl$);

revoke all on function private.watch_uid(), private.watch_go_at(), private.origin_act_kind(text),
  private.origin_kind(text), private.item_origin() from public, anon, authenticated;

-- ------------------------------------------------------------------ the doors

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Whose go, and when it was due, for as long as the go runs.
    (1, 'public.settle(uuid, uuid)'::regprocedure,
     $$      perform set_config('wurm.source', 'act:' || p.act, true);
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      perform set_config('wurm.source', '', true);
$$, $$      perform set_config('wurm.source', 'act:' || p.act, true);
      -- Whose go, and when it was due: on what it makes (`item.origin_uid`) and in the ledger (`watch_rates`).
      perform set_config('wurm.uid', p_uid::text, true);
      perform set_config('wurm.go_at', extract(epoch from p.act_ends)::text, true);
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      perform set_config('wurm.source', '', true);
      perform set_config('wurm.uid', '', true);
      perform set_config('wurm.go_at', '', true);
$$),
    -- A part of a stack is the stack's.
    (2, 'public.move_part(bigint, integer, text, uuid, bigint, bigint)'::regprocedure,
     $$                    extra, rare, dye, bless, charges, locked, maker, piece)
  values (it.world_id, p_holder, p_uid, p_inside, p_placed, it.def, it.ql, it.dmg, p_count,
          it.extra, it.rare, it.dye, it.bless, it.charges, false, it.maker, it.piece)
$$, $$                    extra, rare, dye, bless, charges, locked, maker, piece, origin, origin_fn, origin_uid)
  values (it.world_id, p_holder, p_uid, p_inside, p_placed, it.def, it.ql, it.dmg, p_count,
          it.extra, it.rare, it.dye, it.bless, it.charges, false, it.maker, it.piece,
          coalesce(it.origin, 'before'), it.origin_fn, it.origin_uid)
$$),
    (3, 'public.drain_vessel(bigint, double precision)'::regprocedure,
     $$                    dye, bless, charges, locked, issued, made_at, crate, lit, lit_at, placed, rot_at, maker, piece, mark)
$$, $$                    dye, bless, charges, locked, issued, made_at, crate, lit, lit_at, placed, rot_at, maker, piece, mark,
                    origin, origin_fn, origin_uid)
$$),
    (4, 'public.drain_vessel(bigint, double precision)'::regprocedure,
     $$          it.crate, it.lit, it.lit_at, it.placed, it.rot_at, it.maker, it.piece, it.mark);
$$, $$          it.crate, it.lit, it.lit_at, it.placed, it.rot_at, it.maker, it.piece, it.mark,
          coalesce(it.origin, 'before'), it.origin_fn, it.origin_uid);
$$),
    (5, 'public.rpc_order_fill(uuid, bigint, integer)'::regprocedure,
     $$                        charges, issued, made_at, lit, lit_at, rot_at, maker, piece, keyed)
        values (p_world, 'post', o.poster, v_letter, r.def, r.ql, r.dmg, v_take, r.extra, r.rare, r.dye, r.bless,
                r.charges, r.issued, r.made_at, r.lit, r.lit_at, r.rot_at, r.maker, r.piece, r.keyed);
$$, $$                        charges, issued, made_at, lit, lit_at, rot_at, maker, piece, keyed, origin, origin_fn, origin_uid)
        values (p_world, 'post', o.poster, v_letter, r.def, r.ql, r.dmg, v_take, r.extra, r.rare, r.dye, r.bless,
                r.charges, r.issued, r.made_at, r.lit, r.lit_at, r.rot_at, r.maker, r.piece, r.keyed,
                coalesce(r.origin, 'before'), r.origin_fn, r.origin_uid);
$$)
  ) as t(ord, fn, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    -- Run before: nothing to do.
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
