/*
 * Containers named for an item: every item, not only mortar.
 *
 * Reported: "hoardback is moving mortar perfectly, but isn't moving any of my
 * Ancient Whetstones, Marble Bricks, or anything else". The whetstones were in
 * a wagon and the container named for them was a trash crate ("Ancient
 * Whetstone"). The named sort (`20261120000104_named_containers.sql`) read
 * crates and the pieces that may be marked a settlement store, and took out of
 * none marked one: a wagon, a cart, a trash crate and the settlement's marked
 * stores were none of them read, so nothing in them moved and nothing went
 * into a trash crate, and a target that takes none of a thing (a craft material
 * bin named for whetstones) was said to be full. Now (`private.hoard_boxes`):
 *
 *   * a cart, a large cart or a wagon on the settlement is a source while it is
 *     parked: no driver, nobody pulling it, nothing in its traces; one named
 *     for an item is left alone, neither source nor target;
 *   * a trash crate named for an item is a target for it; unnamed or named for
 *     nothing it is left alone, as before. Nothing on the island rots what is
 *     in a trash crate, so what goes into a named one is kept; the browser's
 *     rot (`Game.runPlaceables`) passes over one named for an item;
 *   * a marked settlement store is a source like any other container (a
 *     padlocked one still is not);
 *   * a name's inner runs of spaces count as one, and an id made plural names
 *     its item ("ancient_whetstones");
 *   * with something to move and none of it moved, an item every target for it
 *     takes none of is said (`namedrefuses`, the item and the nearest such
 *     target's kind in `idle_what`, sent to the card by `rpc_creatures`),
 *     rather than that the targets are full.
 *
 * The browser's half: `src/game/hoard.ts`, `Creatures.hoardBoxes` and `hoardMove`.
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

/* ---- what a name is for ------------------------------------------------------------------------- */

-- A name as it is matched: lower case, spaces round it off and a run of them inside one (`hoardFold`).
create or replace function private.hoard_fold(p_name text) returns text
language sql immutable set search_path = public as $$ select lower(btrim(regexp_replace(p_name, ' {2,}', ' ', 'g'), ' ')) $$;

-- Every item whose name, id, or either made plural is the name (`hoardItems`).
create or replace function private.hoard_items(p_name text) returns text[]
language sql stable set search_path = public as $$
  select case when coalesce(q.v, '') = '' then null else
    (select array_agg(d.id order by d.id collate "C") from item_def d
      where lower(d.id) = q.v or private.hoard_plural(d.id) = q.v or lower(d.name) = q.v or private.hoard_plural(d.name) = q.v) end
  from (select private.hoard_fold(p_name) as v) q
$$;

/* ---- the containers it reads ---------------------------------------------------------------------- */

drop function if exists private.hoard_move(uuid, creature, double precision, double precision, integer, integer);
drop function if exists private.hoard_boxes(uuid, creature);

-- On its keeper's settlement: every crate; every piece that may be marked a store, marked or not; a trash crate named
-- for an item (a target only); a cart or wagon parked and not named for an item (a source only). What its name is for
-- (null for a source), whether it is padlocked, and its kind (`Creatures.hoardBoxes`).
create function private.hoard_boxes(p_world uuid, c creature)
returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, ids text[], shut boolean, sub text)
language sql stable set search_path = public as $$
  with dd as materialized (select d.x, d.y, d.radius from my_deed(p_world, c.keeper) d where d.world_id is not null)
  select 'crate'::text, cr.id::bigint, cr.x, cr.y, crate_centre_x(cr), crate_centre_y(cr), private.hoard_items(cr.name),
         cr.lock is not null, 'crate'::text
    from dd join crate cr on cr.world_id = p_world
     and cr.x between dd.x - dd.radius and dd.x + dd.radius and cr.y between dd.y - dd.radius and dd.y + dd.radius
  union all
  select 'furniture'::text, p.id, p.x, p.y, p.cx, p.cy, case when q.wheels then null else q.ids end, p.lock is not null, p.sub
    from dd join placed p on p.world_id = p_world and p.kind = 'furniture'
     and p.x between dd.x - dd.radius and dd.x + dd.radius and p.y between dd.y - dd.radius and dd.y + dd.radius
    join furniture_def fd on fd.id = p.sub
    cross join lateral (select private.hoard_items(p.name) as ids,
                               (exists (select 1 from vehicle_def v where v.id = p.sub) or coalesce(fd.cart, false))
                               and not exists (select 1 from boat_def b where b.id = p.sub) as wheels) q
   where (coalesce(fd.capacity, 0) > 0 or coalesce(fd.heft, 0) > 0)
     and case when q.wheels
              then q.ids is null and p.driver is null and p.puller is null
                   and not exists (select 1 from creature h where h.world_id = p_world and h.hitched_to = p.id)
              when coalesce(fd.trash, 0) > 0 then q.ids is not null
              else store_markable_refusal(p) is null end
$$;

-- Whether a container takes none of a thing whatever its room: a crate a crate, a piece by `furniture_refuses`.
create or replace function private.hoard_refuses(p_world uuid, p_kind text, p_sid bigint, p_def text) returns boolean
language sql stable set search_path = public as $$
  select case when p_kind = 'crate' then crate_kind_of_item(p_def) is not null
    else coalesce((select furniture_refuses(p, p_def) is not null from placed p where p.id = p_sid), true) end
$$;

-- The stack it moves next, or why there is none (`Creatures.hoardMove`): as before, out of any source not padlocked;
-- and with something to move and none of it moved, `namedrefuses` for the first item every target for it it may use
-- takes none of, its id and the nearest such target's kind in `what`.
create function private.hoard_move(p_world uuid, c creature, p_fx double precision, p_fy double precision,
  p_x integer default null, p_y integer default null)
returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, iid bigint, n integer, why text, what text[])
language plpgsql stable set search_path = public as $$
declare v_boxes jsonb; v_targets jsonb; r record; t record; v_ok jsonb := '{}'; v_key text; v_seen boolean := false; v_room int;
        v_into int; v_refuse boolean; v_first text; v_refused text[];
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
    v_into := 0; v_refuse := true; v_first := null;
    for t in
      select tt.kind, tt.sid, tt.sub from jsonb_to_recordset(v_targets)
          as tt(kind text, sid bigint, cx double precision, cy double precision, ids text[], sub text)
       where r.def = any(tt.ids)
       order by (tt.cx - r.cx) ^ 2 + (tt.cy - r.cy) ^ 2, tt.kind, tt.sid
    loop
      v_key := t.kind || ':' || t.sid;
      if not v_ok ? v_key then v_ok := v_ok || jsonb_build_object(v_key, private.hoard_ok(p_world, c, t.kind, t.sid)); end if;
      if not (v_ok->>v_key)::boolean then continue; end if;
      v_room := private.hoard_room(p_world, t.kind, t.sid, r.def) - private.arms_count(c.carrying, r.def);
      if v_room > 0 then
        kind := r.kind; sid := r.sid; x := r.x; y := r.y; cx := r.cx; cy := r.cy; iid := r.iid;
        n := least(r.cnt, v_room); why := null; what := null;
        return next;
        return;
      end if;
      v_into := v_into + 1;
      v_first := coalesce(v_first, t.sub);
      if not private.hoard_refuses(p_world, t.kind, t.sid, r.def) then v_refuse := false; end if;
    end loop;
    if v_refused is null and v_into > 0 and v_refuse then v_refused := array[r.def, v_first]; end if;
  end loop;
  if v_refused is not null then
    why := 'namedrefuses'; what := v_refused;
  else
    why := case when v_seen then 'namedfull' else 'nomove' end;
  end if;
  return next;
end $$;

-- Recreated over the new `hoard_boxes`, as it was.
create or replace function private.hoard_into(p_world uuid, c creature, p_def text, p_count integer)
returns table(kind text, id bigint, cx double precision, cy double precision)
language sql stable set search_path = public as $$
  select b.kind, b.sid, b.cx, b.cy from private.hoard_boxes(p_world, c) b
   where p_def = any(b.ids) and private.hoard_ok(p_world, c, b.kind, b.sid)
     and private.hoard_room(p_world, b.kind, b.sid, p_def) >= p_count
   order by (b.cx - creature_x(c)) ^ 2 + (b.cy - creature_y(c)) ^ 2, b.kind, b.sid
   limit 1
$$;

/* ---- the worker's card ---------------------------------------------------------------------------- */

select pg_temp.patch_fn('worker_settle(uuid, integer)',
  $o$          if v_hoard.why is not null then c.idle_why := v_hoard.why; end if;$o$,
  $n$          if v_hoard.why is not null then c.idle_why := v_hoard.why; c.idle_what := v_hoard.what; end if;$n$);

select pg_temp.patch_fn('rpc_creatures(uuid, double precision, text, integer[], boolean)',
  $o$'idleWhat', case when c.idle_why in ('stock', 'seam', 'gate') then$o$,
  $n$'idleWhat', case when c.idle_why in ('stock', 'seam', 'gate', 'namedrefuses') then$n$);

select private.lock_doors();
