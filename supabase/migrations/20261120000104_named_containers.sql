/*
 * Containers named for an item: the Chestkit line moves that item into them.
 *
 * Asked: "If a player names an eligible container on their settlement, the
 * wildermon will transport items to that container from any unmatched or
 * unnamed containers. E.g. if a player deposits 500 mortar into a Craft
 * Material Bin named "spill" and has another Craft Material Bin with available
 * space named "Mortar" or "mortar" the wildermon will move the mortar from
 * spill to mortar."
 *
 * Naming was there already (`name_thing`, `placed.name`, `crate.name`). What
 * is new:
 *
 *   * a crate or a storage piece on a settlement (`store_markable_refusal`) is
 *     a target when its name is an item's: its name, its plural or its id, any
 *     case, spaces round it ignored (`private.hoard_items`); every other one is
 *     a source;
 *   * a Chestkit on its settlement, with nothing lying about, takes a stack out
 *     of the nearest source it may use that is not padlocked or marked a
 *     settlement store, of an item a target is named for, as much as the target
 *     for it nearest that source has room for past what of it is in its arms
 *     (`private.hoard_move`, `private.hoard_take`), and carries it to the
 *     nearest target for it with room for all of it (`private.hoard_into`, off
 *     `worker_store`). Before the bins are sorted (`sort_stack`), which now
 *     neither takes out of a target nor counts a bin that is one;
 *   * nothing a Chestkit carries goes into a target named for something else
 *     (`private.hoard_other`, off `worker_store_round`);
 *   * idle, it says which: no container named for an item (`noname`), nothing
 *     in the others for one (`nomove`), every one for what is in them full
 *     (`namedfull`);
 *   * a piece is named only by somebody who may use it: a settlement store by
 *     its rule, a padlock by its key, and otherwise its maker, or a citizen whose
 *     rank holds Crates and stores (`private.name_shut`).
 *
 * The browser's half: `src/game/hoard.ts` and `Creatures.hoardMove` in `src/game/creatures.ts`.
 */
set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/* ---- what a name is for --------------------------------------------------------------------------- */

-- A name as it is matched: lower case, spaces round it off (`hoardFold`).
create or replace function private.hoard_fold(p_name text) returns text
language sql immutable set search_path = public as $$ select lower(btrim(p_name, ' ')) $$;

-- An item's name made plural, lower case: "planks", "berries"; a name ending in s as it is (`hoardPlural`).
create or replace function private.hoard_plural(p_name text) returns text
language sql immutable set search_path = public as $$
  select case when lower(p_name) like '%s' then lower(p_name)
              when lower(p_name) ~ '[^aeiou]y$' then left(lower(p_name), -1) || 'ies'
              else lower(p_name) || 's' end
$$;

-- The items a container's name is for, by id in code-point order: every item whose name, plural or id is the name.
-- Null for no name and for a name no item has: that container is a source (`hoardItems`).
create or replace function private.hoard_items(p_name text) returns text[]
language sql stable set search_path = public as $$
  select case when coalesce(q.v, '') = '' then null else
    (select array_agg(d.id order by d.id collate "C") from item_def d
      where lower(d.id) = q.v or lower(d.name) = q.v or private.hoard_plural(d.name) = q.v) end
  from (select private.hoard_fold(p_name) as v) q
$$;

-- How many of a thing are in a worker's arms, over every load of the trip (`inArms`).
create or replace function private.arms_count(p_arms jsonb, p_def text) returns integer
language sql immutable set search_path = public as $$
  select coalesce(sum(coalesce((l->>'count')::int, 1)), 0)::int
    from (select p_arms as l where p_arms is not null
          union all
          select e from jsonb_array_elements(coalesce(p_arms->'more', '[]'::jsonb)) e) q
   where q.l->>'def' = p_def
$$;

/* ---- the containers it looks at ------------------------------------------------------------------- */

-- Every crate, and every piece that may be marked a store, on its keeper's settlement: what its name is for (null for a
-- source), and whether it is padlocked or marked a settlement store (`Creatures.hoardBoxes`).
create or replace function private.hoard_boxes(p_world uuid, c creature)
returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, ids text[], shut boolean)
language sql stable set search_path = public as $$
  with dd as materialized (select d.x, d.y, d.radius from my_deed(p_world, c.keeper) d where d.world_id is not null)
  select 'crate'::text, cr.id::bigint, cr.x, cr.y, crate_centre_x(cr), crate_centre_y(cr), private.hoard_items(cr.name),
         cr.lock is not null or cr.store_of is not null
    from dd join crate cr on cr.world_id = p_world
     and cr.x between dd.x - dd.radius and dd.x + dd.radius and cr.y between dd.y - dd.radius and dd.y + dd.radius
  union all
  select 'furniture'::text, p.id, p.x, p.y, p.cx, p.cy, private.hoard_items(p.name), p.lock is not null or p.store_of is not null
    from dd join placed p on p.world_id = p_world and p.kind = 'furniture'
     and p.x between dd.x - dd.radius and dd.x + dd.radius and p.y between dd.y - dd.radius and dd.y + dd.radius
    join furniture_def fd on fd.id = p.sub
   where (coalesce(fd.capacity, 0) > 0 or coalesce(fd.heft, 0) > 0) and store_markable_refusal(p) is null
$$;

-- Whether its keeper's worker may use a container (`worker_crate_ok`, `worker_piece_ok`; `DeedStore.workerMay`).
create or replace function private.hoard_ok(p_world uuid, c creature, p_kind text, p_sid bigint) returns boolean
language sql stable set search_path = public as $$
  select case when p_kind = 'crate'
    then coalesce((select private.worker_crate_ok(p_world, c.keeper, cr) from crate cr where cr.world_id = p_world and cr.id = p_sid::int), false)
    else coalesce((select private.worker_piece_ok(p_world, c.keeper, p) from placed p where p.id = p_sid), false) end
$$;

-- How many of a thing a container has room for: a crate but for a crate, a piece by `furniture_room` when it takes it.
create or replace function private.hoard_room(p_world uuid, p_kind text, p_sid bigint, p_def text) returns integer
language sql stable set search_path = public as $$
  select coalesce(case when p_kind = 'crate'
    then (select case when crate_kind_of_item(p_def) is not null then 0
                      else greatest(0, crate_capacity(cr) - crate_units(p_world, cr.id)) end
            from crate cr where cr.world_id = p_world and cr.id = p_sid::int)
    else (select case when furniture_refuses(p, p_def) is not null then 0 else furniture_room(p, p_def) end
            from placed p where p.id = p_sid) end, 0)
$$;

/* ---- the move ------------------------------------------------------------------------------------- */

-- The stack a Chestkit moves next to a container named for it, or why there is none (`Creatures.hoardMove`): out of
-- the source on (p_x, p_y) when given, the nearest to (p_fx, p_fy) otherwise -- not named for an item, not padlocked
-- or marked a settlement store, one it may use -- the first stack in it, not locked, of an item a target is named for;
-- into the target for it nearest that source that it may use, with room for some past what of it is in its arms; as
-- many as that room. `noname` with no target, `namedfull` with something to move and every target for it full,
-- `nomove` with nothing to move.
create or replace function private.hoard_move(p_world uuid, c creature, p_fx double precision, p_fy double precision,
  p_x integer default null, p_y integer default null)
returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, iid bigint, n integer, why text)
language plpgsql stable set search_path = public as $$
declare v_boxes jsonb; v_targets jsonb; r record; t record; v_ok jsonb := '{}'; v_key text; v_seen boolean := false; v_room int;
begin
  select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) into v_boxes from private.hoard_boxes(p_world, c) b;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_targets from jsonb_array_elements(v_boxes) e where jsonb_typeof(e->'ids') = 'array';
  if jsonb_array_length(v_targets) = 0 then
    why := 'noname';
    return next;
    return;
  end if;
  for r in
    with src as materialized (
      select s.* from jsonb_to_recordset(v_boxes)
          as s(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, ids text[], shut boolean)
       where s.ids is null and not s.shut and (p_x is null or (s.x = p_x and s.y = p_y))
    )
    select q.* from (
      select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i.id as iid, i.def, i.count as cnt, i.locked
        from src s join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = s.sid::int where s.kind = 'crate'
      union all
      select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i.id, i.def, i.count, i.locked
        from src s join item i on i.placed = s.sid and i.holder = 'furniture' where s.kind = 'furniture'
    ) q
     where q.cnt > 0 and not coalesce(q.locked, false)
       and exists (select 1 from jsonb_array_elements(v_targets) e where e->'ids' ? q.def)
     order by (q.cx - p_fx) ^ 2 + (q.cy - p_fy) ^ 2, q.kind, q.sid, q.iid
  loop
    v_key := r.kind || ':' || r.sid;
    if not v_ok ? v_key then v_ok := v_ok || jsonb_build_object(v_key, private.hoard_ok(p_world, c, r.kind, r.sid)); end if;
    if not (v_ok->>v_key)::boolean then continue; end if;
    v_seen := true;
    for t in
      select tt.kind, tt.sid from jsonb_to_recordset(v_targets)
          as tt(kind text, sid bigint, cx double precision, cy double precision, ids text[])
       where r.def = any(tt.ids)
       order by (tt.cx - r.cx) ^ 2 + (tt.cy - r.cy) ^ 2, tt.kind, tt.sid
    loop
      v_key := t.kind || ':' || t.sid;
      if not v_ok ? v_key then v_ok := v_ok || jsonb_build_object(v_key, private.hoard_ok(p_world, c, t.kind, t.sid)); end if;
      if not (v_ok->>v_key)::boolean then continue; end if;
      v_room := private.hoard_room(p_world, t.kind, t.sid, r.def) - private.arms_count(c.carrying, r.def);
      if v_room > 0 then
        kind := r.kind; sid := r.sid; x := r.x; y := r.y; cx := r.cx; cy := r.cy; iid := r.iid;
        n := least(r.cnt, v_room); why := null;
        return next;
        return;
      end if;
    end loop;
  end loop;
  why := case when v_seen then 'namedfull' else 'nomove' end;
  return next;
end $$;

-- The stack moved out of the source on (p_x, p_y), as `sort_take` takes one: the load, or null.
create or replace function private.hoard_take(p_world uuid, c creature, p_x integer, p_y integer) returns jsonb
language plpgsql set search_path = public as $$
declare s record; v item;
begin
  select * into s from private.hoard_move(p_world, c, p_x + 0.5, p_y + 0.5, p_x, p_y) h where h.iid is not null;
  if s.iid is null then return null; end if;
  select * into v from item where id = s.iid and holder in ('crate', 'furniture') for update;
  if v.id is null then return null; end if;
  if v.count > s.n then update item set count = count - s.n where id = v.id;
  else delete from item where id = v.id; end if;
  return jsonb_build_object('def', v.def, 'count', least(s.n, v.count), 'ql', v.ql, 'extra', v.extra);
end $$;

-- Whether a worker is a Chestkit at work on its settlement: the fetch trade, off a post and not round its keeper.
create or replace function private.hoard_trade(c creature) returns boolean
language sql stable set search_path = public as $$
  select c.post is null and c.around is null
     and coalesce(c.job, (select sd.gathers from species_def sd where sd.id = c.species)) = 'fetch'
$$;

-- Where such a worker puts a load first: the target named for it nearest to it that it may use, with room for all of it.
create or replace function private.hoard_into(p_world uuid, c creature, p_def text, p_count integer)
returns table(kind text, id bigint, cx double precision, cy double precision)
language sql stable set search_path = public as $$
  select b.kind, b.sid, b.cx, b.cy from private.hoard_boxes(p_world, c) b
   where p_def = any(b.ids) and private.hoard_ok(p_world, c, b.kind, b.sid)
     and private.hoard_room(p_world, b.kind, b.sid, p_def) >= p_count
   order by (b.cx - creature_x(c)) ^ 2 + (b.cy - creature_y(c)) ^ 2, b.kind, b.sid
   limit 1
$$;

-- Whether a container named for items, not this one, is shut to what such a worker carries (`hoardOther`).
create or replace function private.hoard_other(c creature, p_name text, p_def text) returns boolean
language plpgsql stable set search_path = public as $$
declare v text[];
begin
  if p_name is null then return false; end if;
  v := private.hoard_items(p_name);
  return v is not null and not (p_def = any(v)) and private.hoard_trade(c);
end $$;

/* ---- the worker ----------------------------------------------------------------------------------- */

-- Its idle reason, and the move before the bins are sorted.
select pg_temp.patch_fn('worker_settle(uuid, integer)',
  $o$v_sort record; v_spar creature;$o$,
  $n$v_sort record; v_hoard record; v_spar creature;$n$);

select pg_temp.patch_fn('worker_settle(uuid, integer)',
  $o$      if spot.x is null and kind = 'fetch' and v_site.post is null and c.around is null then
        select * into v_sort from sort_stack(p_world, c, cx, cy);$o$,
  $n$      if spot.x is null and kind = 'fetch' and v_site.post is null and c.around is null then
        -- First a stack to a container named for it (`private.hoard_move`), then the bins (`sort_stack`).
        select * into v_hoard from private.hoard_move(p_world, c, cx, cy);
        if v_hoard.iid is not null then v_sort := v_hoard;
        else select * into v_sort from sort_stack(p_world, c, cx, cy); end if;$n$);

select pg_temp.patch_fn('worker_settle(uuid, integer)',
  $o$        if kind = 'quarry' then
          select * into v_mi from stone_idle(p_world, v_site.x, v_site.y, v_site.radius, c);
          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;$o$,
  $n$        if kind = 'quarry' then
          select * into v_mi from stone_idle(p_world, v_site.x, v_site.y, v_site.radius, c);
          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;
        -- A Chestkit on its settlement: why nothing moved to a container named for it (`private.hoard_move`), asked
        -- only of one, which asked for it above.
        if kind = 'fetch' and v_site.post is null and c.around is null then
          if v_hoard.why is not null then c.idle_why := v_hoard.why; end if;
        end if;$n$);

-- Its go at a source: what lies there, else the stack for a container named for it, else the bins'.
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$      if not found then return sort_take(p_world, c, wx, wy); end if;$o$,
  $n$      if not found then return coalesce(private.hoard_take(p_world, c, wx, wy), sort_take(p_world, c, wx, wy)); end if;$n$);

-- Where it puts a load: a container named for it first.
select pg_temp.patch_fn('worker_store(uuid, creature, text, integer)',
  $o$  -- Then home: the settlement's own crate while it has room, and the nearest thing on the deed that will take it after.$o$,
  $n$  -- A Chestkit on its settlement: a container named for the load first (`private.hoard_into`).
  if private.hoard_trade(c) then
    return query select * from private.hoard_into(p_world, c, p_def, p_count);
    if found then return; end if;
  end if;
  -- Then home: the settlement's own crate while it has room, and the nearest thing on the deed that will take it after.$n$);

-- And never one named for something else.
select pg_temp.patch_fn('private.worker_store_round(uuid, creature, text, integer, double precision, double precision, integer, double precision, boolean)',
  $o$  loop
    if r.s_kind = 'crate' then$o$,
  $n$  loop
    if private.hoard_other(c, coalesce((r.s_cr).name, (r.s_pl).name), p_def) then continue; end if;
    if r.s_kind = 'crate' then$n$);

-- The bins' sort: never out of a container named for an item, and no bin named for one counted.
select pg_temp.patch_fn('sort_stack(uuid, creature, double precision, double precision, integer, integer)',
  $o$     and bp.kind = 'furniture' and fd.takes in ('raw', 'worked');$o$,
  $n$     and bp.kind = 'furniture' and fd.takes in ('raw', 'worked') and private.hoard_items(bp.name) is null;$n$);

select pg_temp.patch_fn('sort_stack(uuid, creature, double precision, double precision, integer, integer)',
  $o$                                and cr.lock is null and cr.store_of is null)$o$,
  $n$                                and cr.lock is null and cr.store_of is null and private.hoard_items(cr.name) is null)$n$);

select pg_temp.patch_fn('sort_stack(uuid, creature, double precision, double precision, integer, integer)',
  $o$                              where pl.id = s.sid and pl.lock is null and pl.store_of is null and fd.takes is null$o$,
  $n$                              where pl.id = s.sid and pl.lock is null and pl.store_of is null and fd.takes is null
                                and private.hoard_items(pl.name) is null$n$);

/* ---- naming: only what you may use -------------------------------------------------------------- */

-- Why you may not name a piece, or null: a settlement store by its rule, a padlock by its key, and otherwise its maker or
-- a citizen whose rank holds Crates and stores (`nameThingRefusal`).
create or replace function private.name_shut(p_world uuid, p_uid uuid, p_id bigint) returns text
language plpgsql stable set search_path = public as $$
declare p placed; v text;
begin
  select * into p from placed where world_id = p_world and id = p_id;
  if p.id is null then return 'That is not there any more.'; end if;
  v := store_shut_piece(p_world, p_uid, p);
  if v is not null or p.store_of is not null then return v; end if;
  if coalesce(p.made_by = p_uid, true) or deed_may_at(p_world, p_uid, p.x, p.y, power_bit('stores')) then return null; end if;
  return coalesce(rank_lacks_at(p_world, p_uid, p.x, p.y, 'stores'), 'Not yours to name: ' || placed_name_in_line(p) || '.');
end $$;

select pg_temp.patch_fn('hands_refusal(uuid, uuid, text, jsonb)',
  $o$                       and kind = 'furniture') then
        return 'That is not there any more.';
      end if;$o$,
  $n$                       and kind = 'furniture') then
        return 'That is not there any more.';
      end if;
      return private.name_shut(p_world, p_uid, (p_target->>'id')::bigint);$n$);

select private.lock_doors();
